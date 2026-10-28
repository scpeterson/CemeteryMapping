import { BadRequestError, ConflictError } from "./requestValidation.mjs";
import { withAuditContext } from "./auditContext.mjs";
import { auditEventIdForMutation } from "./cemeteryAudit.mjs";
import { selectGraveUpdateState } from "./cemeteryMutationTargets.mjs";

async function selectGraveMutationState(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        id::text AS uuid,
        cemetery_id::text,
        gravesite_id,
        deleted_at,
        deleted_by::text,
        delete_reason,
        updated_at
      FROM gravesites
      WHERE cemetery_id = $1
        AND gravesite_id = $2
      FOR UPDATE
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

export async function updateGraveSpaceMutation(
  pool,
  cemeteryId,
  gravesiteId,
  graveSpace,
  { actorUser, reason, allowedCemeteryIds } = {},
  loadDetailedGrave,
) {
  return withAuditContext(pool, { actorUser, reason }, async (client, rollback) => {
    const existing = await selectGraveUpdateState(client, cemeteryId, gravesiteId);
    if (!existing) {
      return rollback(undefined);
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existing.cemetery_id)) {
      return rollback(undefined);
    }

    // The row lock serializes writers; the version check also rejects forms
    // loaded before an earlier writer committed.
    if (!graveSpace.expectedVersion || graveSpace.expectedVersion !== existing.version) throw new ConflictError();

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET name = $2,
            status_type_id = (
              SELECT id
              FROM gravesite_status_types
              WHERE code = $3
            ),
            cost = $4::numeric
        WHERE id = $1
        RETURNING
          id::text AS uuid,
          cemetery_id::text,
          name,
          gravesite_id,
          status_type_id::text,
          (
            SELECT code
            FROM gravesite_status_types
            WHERE id = gravesites.status_type_id
          ) AS status,
          cost,
          updated_at
      `,
      [existing.uuid, graveSpace.name || null, graveSpace.status, graveSpace.cost ?? null],
    );
    const updatedState = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "update",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updatedState,
      reason,
    });

    const detailedGrave = await loadDetailedGrave(client, cemeteryId, gravesiteId);

    return { ...detailedGrave, auditEventId };

  });
}

export async function updateGraveLotAssignment(pool, cemeteryId, gravesiteId, lotId, { actorUser, reason, allowedCemeteryIds, lotUuid } = {}) {
  let selectedLotLabel;
  try {
    return await withAuditContext(pool, { actorUser, reason: reason ?? "Gravesite lot assignment update" }, async (client, rollback) => {
      if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) return rollback(undefined);
      const lotResult = lotUuid || lotId
        ? await client.query(`SELECT id, lot_id, section_id, section_uuid, block_id, block_uuid, burial_use_status FROM lots
            WHERE cemetery_id=$1 AND ${lotUuid ? "id=$2::uuid" : "lot_id=$2"} AND deleted_at IS NULL`, [cemeteryId, lotUuid || lotId])
        : { rows: [{ id: null, lot_id: null, section_id: null, section_uuid: null, block_id: null, block_uuid: null }] };
      if (!lotResult.rows.length) return rollback({ invalid: "lot_not_found" });
      if (lotResult.rows.length > 1) throw new BadRequestError("This lot number occurs in more than one section. Reload and select the section-specific lot.");
      const lot = lotResult.rows[0];
      selectedLotLabel = [lot.section_id, lot.lot_id].filter(Boolean).join("-");
      if (lot.burial_use_status === "non_burial") throw new ConflictError(`Lot ${[lot.section_id,lot.lot_id].filter(Boolean).join("-")} cannot contain gravesites or markers.`);
      const result = await client.query(
        `UPDATE gravesites SET lot_uuid=$3::uuid, lot_id=$4, section_id=COALESCE($5::text, section_id),
           section_uuid=CASE WHEN $3::uuid IS NULL THEN section_uuid ELSE $6::uuid END,
           block_id=CASE WHEN $3::uuid IS NULL THEN block_id ELSE $7::text END,
           block_uuid=CASE WHEN $3::uuid IS NULL THEN block_uuid ELSE $8::uuid END, updated_at=now()
         WHERE cemetery_id=$1 AND gravesite_id=$2 AND deleted_at IS NULL RETURNING gravesite_id, lot_id, section_id`,
        [cemeteryId, gravesiteId, lot.id, lot.lot_id, lot.section_id, lot.section_uuid, lot.block_id, lot.block_uuid],
      );
      if (!result.rowCount) return rollback(undefined);
      return { id: gravesiteId, lotId: result.rows[0].lot_id ?? "", section: result.rows[0].section_id ?? "" };
    });
  } catch (error) {
    if (error.code === "23514" && error.where?.includes("enforce_lot_gravesite_limit")) {
      throw new ConflictError(`Lot ${selectedLotLabel} already has the maximum of five active gravesites. Review its existing assignments before adding another.`);
    }
    if (error.code === "23514" && error.where?.includes("enforce_lot_burial_use_restrictions")) throw new ConflictError(error.message);
    throw error;
  }
}

export async function softDeleteGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  return withAuditContext(pool, { actorUser, reason }, async (client, rollback) => {
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      return rollback(undefined);
    }

    if (existing.deleted_at) {

      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        deletedAt: existing.deleted_at,
        alreadyDeleted: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = now(),
            deleted_by = $3::uuid,
            delete_reason = $2
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid, reason, actorUser?.id ?? null],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "soft_delete",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      deletedAt: updated.deleted_at,
      auditEventId,
      alreadyDeleted: false,
    };

  });
}

export async function restoreGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  return withAuditContext(pool, { actorUser, reason }, async (client, rollback) => {
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      return rollback(undefined);
    }

    if (!existing.deleted_at) {

      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        restored: true,
        alreadyActive: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "restore",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      restored: true,
      auditEventId,
      alreadyActive: false,
    };

  });
}
