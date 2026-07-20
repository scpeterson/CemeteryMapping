import { setAuditContext } from "./auditContext.mjs";
import { maintenanceRecordJoinSql, maintenanceRecordSelectSql } from "./cemeteryMaintenanceQueries.mjs";
import { toMaintenanceRecord } from "./cemeteryMappers.mjs";

export async function createMaintenanceRecord(pool, cemeteryId, record, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    let gravesiteUuid = null;
    if (record.graveSpaceId) {
      const graveResult = await client.query(
        `
          SELECT id::text
          FROM gravesites
          WHERE cemetery_id = $1
            AND gravesite_id = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [cemeteryId, record.graveSpaceId],
      );
      gravesiteUuid = graveResult.rows[0]?.id ?? null;
      if (!gravesiteUuid) {
        await client.query("ROLLBACK");
        return undefined;
      }
    }

    let headstoneUuid = record.headstoneId || null;
    if (headstoneUuid) {
      const headstoneResult = await client.query(
        `
          SELECT headstones.id::text
          FROM headstones
          LEFT JOIN gravesites AS direct_gravesite
            ON direct_gravesite.id = headstones.gravesite_uuid
           AND direct_gravesite.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT gravesites.cemetery_id
            FROM headstone_gravesites
            JOIN gravesites
              ON gravesites.id = headstone_gravesites.gravesite_uuid
             AND gravesites.deleted_at IS NULL
            WHERE headstone_gravesites.headstone_uuid = headstones.id
              AND headstone_gravesites.deleted_at IS NULL
              AND gravesites.cemetery_id = $2
            LIMIT 1
          ) linked_gravesite ON true
          LEFT JOIN LATERAL (
            SELECT cemeteries.id
            FROM cemeteries
            WHERE headstones.geometry IS NOT NULL
              AND cemeteries.deleted_at IS NULL
              AND ST_Covers(cemeteries.geometry, headstones.geometry)
            ORDER BY cemeteries.name, cemeteries.id
            LIMIT 1
          ) containing_cemetery ON true
          WHERE headstones.id = $1
            AND headstones.deleted_at IS NULL
            AND COALESCE(direct_gravesite.cemetery_id, linked_gravesite.cemetery_id, containing_cemetery.id) = $2
          LIMIT 1
        `,
        [headstoneUuid, cemeteryId],
      );
      headstoneUuid = headstoneResult.rows[0]?.id ?? null;
      if (!headstoneUuid) {
        await client.query("ROLLBACK");
        return undefined;
      }
    }

    const insertResult = await client.query(
      `
        INSERT INTO maintenance_records (
          cemetery_id,
          gravesite_uuid,
          headstone_uuid,
          issue_type_id,
          action_type_id,
          priority_type_id,
          status,
          observed_at,
          completed_at,
          performed_by,
          source_type,
          notes
        )
        VALUES (
          $1,
          $2::uuid,
          $3::uuid,
          NULLIF($4, '')::uuid,
          NULLIF($5, '')::uuid,
          $6::uuid,
          $7,
          $8::date,
          NULLIF($9, '')::date,
          NULLIF($10, ''),
          $11,
          NULLIF($12, '')
        )
        RETURNING id::text
      `,
      [
        cemeteryId,
        gravesiteUuid,
        headstoneUuid,
        record.issueTypeId || "",
        record.actionTypeId || "",
        record.priorityTypeId,
        record.status || "open",
        record.observedAt,
        record.completedAt || "",
        record.performedBy || "",
        record.sourceType || "manual",
        record.notes || "",
      ],
    );

    const result = await client.query(
      `
        SELECT ${maintenanceRecordSelectSql}
        FROM maintenance_records
        ${maintenanceRecordJoinSql}
        WHERE maintenance_records.id = $1
      `,
      [insertResult.rows[0].id],
    );

    await client.query("COMMIT");
    return toMaintenanceRecord(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMaintenanceRecord(pool, id, record, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    const existing = await client.query(
      `
        SELECT id::text, cemetery_id::text
        FROM maintenance_records
        WHERE id = $1
          AND deleted_at IS NULL
        FOR UPDATE
      `,
      [id],
    );
    const existingRecord = existing.rows[0];
    if (!existingRecord || (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(existingRecord.cemetery_id))) {
      await client.query("ROLLBACK");
      return undefined;
    }

    await client.query(
      `
        UPDATE maintenance_records
        SET
          issue_type_id = NULLIF($2, '')::uuid,
          action_type_id = NULLIF($3, '')::uuid,
          priority_type_id = $4::uuid,
          status = $5,
          observed_at = $6::date,
          completed_at = NULLIF($7, '')::date,
          performed_by = NULLIF($8, ''),
          source_type = $9,
          notes = NULLIF($10, '')
        WHERE id = $1
      `,
      [
        id,
        record.issueTypeId || "",
        record.actionTypeId || "",
        record.priorityTypeId,
        record.status || "open",
        record.observedAt,
        record.completedAt || "",
        record.performedBy || "",
        record.sourceType || "manual",
        record.notes || "",
      ],
    );

    const result = await client.query(
      `
        SELECT ${maintenanceRecordSelectSql}
        FROM maintenance_records
        ${maintenanceRecordJoinSql}
        WHERE maintenance_records.id = $1
      `,
      [id],
    );

    await client.query("COMMIT");
    return toMaintenanceRecord(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

