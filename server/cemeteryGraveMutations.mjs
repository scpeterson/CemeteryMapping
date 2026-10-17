import { ConflictError } from "./requestValidation.mjs";
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

export async function updateGraveLotAssignment(pool, cemeteryId, gravesiteId, lotId, { actorUser, reason, allowedCemeteryIds } = {}) {
  return withAuditContext(pool, { actorUser, reason: reason ?? "Gravesite lot assignment update" }, async (client, rollback) => {
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      return rollback(undefined);
    }
    const lotResult = lotId
      ? await client.query(`SELECT id, lot_id, section_id FROM lots WHERE cemetery_id=$1 AND lot_id=$2 AND deleted_at IS NULL`, [cemeteryId, lotId])
      : { rows: [{ id: null, lot_id: null, section_id: null }] };
    if (!lotResult.rows[0]) {
      return rollback({ invalid: "lot_not_found" });
    }
    const lot = lotResult.rows[0];
    const result = await client.query(
      `UPDATE gravesites SET lot_uuid=$3::uuid, lot_id=$4, section_id=COALESCE($5, section_id), updated_at=now()
       WHERE cemetery_id=$1 AND gravesite_id=$2 AND deleted_at IS NULL RETURNING gravesite_id`,
      [cemeteryId, gravesiteId, lot.id, lot.lot_id, lot.section_id],
    );
    if (!result.rowCount) {
      return rollback(undefined);
    }

    return { id: gravesiteId, lotId: lot.lot_id ?? "" };

  });
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
