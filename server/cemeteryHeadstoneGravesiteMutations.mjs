import { setAuditContext } from "./auditContext.mjs";
import { selectHeadstoneMutationState } from "./cemeteryMutationTargets.mjs";

async function selectGravesite(client, id) {
  const result = await client.query(
    `
      SELECT id::text, cemetery_id::text, gravesite_id, name
      FROM gravesites
      WHERE id = $1
        AND deleted_at IS NULL
      FOR UPDATE
    `,
    [id],
  );
  return result.rows[0];
}

async function selectRelationship(client, id) {
  const result = await client.query(
    `
      SELECT
        headstone_gravesites.id::text,
        headstone_gravesites.headstone_uuid::text,
        gravesites.id::text AS "gravesiteUuid",
        gravesites.gravesite_id AS "gravesiteId",
        concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS "graveId",
        gravesites.name AS "gravesiteName",
        headstone_gravesites.relationship_type AS "relationshipType",
        COALESCE(headstone_gravesites.notes, '') AS notes
      FROM headstone_gravesites
      JOIN gravesites ON gravesites.id = headstone_gravesites.gravesite_uuid
      WHERE headstone_gravesites.id = $1
        AND headstone_gravesites.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
    `,
    [id],
  );
  return result.rows[0];
}

export async function createHeadstoneGravesiteRelationship(pool, headstoneId, relationship, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const headstone = await selectHeadstoneMutationState(client, headstoneId);
    const gravesite = await selectGravesite(client, relationship.gravesiteId);
    if (!headstone || !gravesite) {
      await client.query("ROLLBACK");
      return undefined;
    }
    if (headstone.cemetery_id !== gravesite.cemetery_id) {
      await client.query("ROLLBACK");
      return { invalid: "different_cemetery" };
    }
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(headstone.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }
    const result = await client.query(
      `
        INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
        VALUES ($1, $2, $3, NULLIF($4, ''))
        ON CONFLICT (headstone_uuid, gravesite_uuid)
        DO UPDATE SET
          relationship_type = EXCLUDED.relationship_type,
          notes = EXCLUDED.notes,
          deleted_at = NULL,
          deleted_by = NULL,
          delete_reason = NULL
        RETURNING id::text
      `,
      [headstone.id, gravesite.id, relationship.relationshipType, relationship.notes],
    );
    await client.query("UPDATE headstones SET gravesite_uuid = COALESCE(gravesite_uuid, $2) WHERE id = $1", [headstone.id, gravesite.id]);
    const created = await selectRelationship(client, result.rows[0].id);
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateHeadstoneGravesiteRelationship(pool, id, relationship, options = {}) {
  const { actorUser, reason, allowedCemeteryIds } = options;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectRelationship(client, id);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    const headstone = await selectHeadstoneMutationState(client, existing.headstone_uuid);
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(headstone?.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }
    await client.query(
      "UPDATE headstone_gravesites SET relationship_type = $2, notes = NULLIF($3, '') WHERE id = $1 AND deleted_at IS NULL",
      [id, relationship.relationshipType, relationship.notes],
    );
    const updated = await selectRelationship(client, id);
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteHeadstoneGravesiteRelationship(pool, id, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectRelationship(client, id);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }
    const headstone = await selectHeadstoneMutationState(client, existing.headstone_uuid);
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(headstone?.cemetery_id)) {
      await client.query("ROLLBACK");
      return { forbidden: true };
    }
    const result = await client.query(
      `
        UPDATE headstone_gravesites
        SET deleted_at = now(), deleted_by = $2, delete_reason = $3
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id::text, deleted_at
      `,
      [id, actorUser?.id ?? actorUser?.subject ?? null, reason ?? null],
    );
    await client.query(
      `
        UPDATE headstones
        SET gravesite_uuid = (
          SELECT gravesite_uuid
          FROM headstone_gravesites
          WHERE headstone_uuid = headstones.id AND deleted_at IS NULL
          ORDER BY CASE relationship_type WHEN 'primary' THEN 1 WHEN 'spans' THEN 2 ELSE 3 END, created_at, id
          LIMIT 1
        )
        WHERE id = $1 AND gravesite_uuid = $2
      `,
      [headstone.id, existing.gravesiteUuid],
    );
    await client.query("COMMIT");
    return { id: result.rows[0].id, deletedAt: result.rows[0].deleted_at, alreadyDeleted: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
