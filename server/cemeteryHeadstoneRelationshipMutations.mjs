import { setAuditContext } from "./auditContext.mjs";
import { toHeadstoneRelationship } from "./cemeteryMappers.mjs";
import { selectHeadstoneMutationState } from "./cemeteryMutationTargets.mjs";
import { headstoneRelationshipJoinSql, headstoneRelationshipSelectSql, headstoneRelationshipTableExists } from "./cemeteryRelationshipQueries.mjs";

async function selectHeadstoneRelationshipById(client, id, currentHeadstoneUuid) {
  if (!(await headstoneRelationshipTableExists(client))) return undefined;

  const result = await client.query(
    `
      SELECT ${headstoneRelationshipSelectSql}
      FROM headstone_relationships
      ${headstoneRelationshipJoinSql}
      WHERE headstone_relationships.id = $2
        AND headstone_relationships.deleted_at IS NULL
      LIMIT 1
    `,
    [currentHeadstoneUuid, id],
  );

  return result.rows[0];
}

export async function createHeadstoneRelationship(pool, headstoneId, relationship, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const fromHeadstone = await selectHeadstoneMutationState(client, headstoneId);
    const toHeadstone = await selectHeadstoneMutationState(client, relationship.relatedHeadstoneId);
    if (!fromHeadstone || !toHeadstone) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (fromHeadstone.id === toHeadstone.id) {
      await client.query("ROLLBACK");
      return { invalid: "same_marker" };
    }
    if (!fromHeadstone.cemetery_id || fromHeadstone.cemetery_id !== toHeadstone.cemetery_id) {
      await client.query("ROLLBACK");
      return { invalid: "different_cemetery" };
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(fromHeadstone.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }

    const insertResult = await client.query(
      `
        INSERT INTO headstone_relationships (
          from_headstone_uuid,
          to_headstone_uuid,
          relationship_type,
          source_type,
          source_text,
          confidence,
          notes,
          status
        )
        VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), $8)
        ON CONFLICT (from_headstone_uuid, to_headstone_uuid, relationship_type)
        WHERE deleted_at IS NULL
        DO UPDATE
        SET source_type = EXCLUDED.source_type,
            source_text = EXCLUDED.source_text,
            confidence = EXCLUDED.confidence,
            notes = EXCLUDED.notes,
            status = EXCLUDED.status
        RETURNING id::text
      `,
      [
        fromHeadstone.id,
        toHeadstone.id,
        relationship.relationshipType,
        relationship.sourceType || "manual",
        relationship.sourceText || "",
        relationship.confidence || "review",
        relationship.notes || "",
        relationship.status || "active",
      ],
    );

    const created = await selectHeadstoneRelationshipById(client, insertResult.rows[0].id, fromHeadstone.id);
    await client.query("COMMIT");
    return toHeadstoneRelationship(created);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateHeadstoneRelationship(pool, id, relationship, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const existingResult = await client.query(
      `
        SELECT
          headstone_relationships.id::text,
          headstone_relationships.from_headstone_uuid::text,
          headstone_relationships.to_headstone_uuid::text
        FROM headstone_relationships
        WHERE headstone_relationships.id = $1
          AND headstone_relationships.deleted_at IS NULL
        FOR UPDATE
      `,
      [id],
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const fromHeadstone = await selectHeadstoneMutationState(client, existing.from_headstone_uuid);
    const toHeadstone = await selectHeadstoneMutationState(client, relationship.relatedHeadstoneId || existing.to_headstone_uuid);
    if (!fromHeadstone || !toHeadstone) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (fromHeadstone.id === toHeadstone.id) {
      await client.query("ROLLBACK");
      return { invalid: "same_marker" };
    }
    if (!fromHeadstone.cemetery_id || fromHeadstone.cemetery_id !== toHeadstone.cemetery_id) {
      await client.query("ROLLBACK");
      return { invalid: "different_cemetery" };
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(fromHeadstone.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }

    await client.query(
      `
        UPDATE headstone_relationships
        SET to_headstone_uuid = $2,
            relationship_type = $3,
            source_type = $4,
            source_text = NULLIF($5, ''),
            confidence = $6,
            notes = NULLIF($7, ''),
            status = $8
        WHERE id = $1
      `,
      [
        id,
        toHeadstone.id,
        relationship.relationshipType,
        relationship.sourceType || "manual",
        relationship.sourceText || "",
        relationship.confidence || "review",
        relationship.notes || "",
        relationship.status || "active",
      ],
    );

    const updated = await selectHeadstoneRelationshipById(client, id, fromHeadstone.id);
    await client.query("COMMIT");
    return toHeadstoneRelationship(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteHeadstoneRelationship(pool, id, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const existingResult = await client.query(
      `
        SELECT
          headstone_relationships.id::text,
          headstone_relationships.from_headstone_uuid::text,
          headstone_relationships.deleted_at
        FROM headstone_relationships
        WHERE headstone_relationships.id = $1
        LIMIT 1
      `,
      [id],
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (existing.deleted_at) {
      await client.query("COMMIT");
      return { id: existing.id, deletedAt: existing.deleted_at, alreadyDeleted: true };
    }

    const fromHeadstone = await selectHeadstoneMutationState(client, existing.from_headstone_uuid);
    if (!fromHeadstone) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(fromHeadstone.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }

    const updateResult = await client.query(
      `
        UPDATE headstone_relationships
        SET deleted_at = now(),
            deleted_by = $2,
            delete_reason = $3
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id::text, deleted_at
      `,
      [id, actorUser?.id ?? actorUser?.subject ?? null, reason ?? null],
    );

    await client.query("COMMIT");
    return { id: updateResult.rows[0].id, deletedAt: updateResult.rows[0].deleted_at, alreadyDeleted: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

