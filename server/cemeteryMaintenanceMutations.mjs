import { setAuditContext } from "./auditContext.mjs";
import { maintenanceRecordJoinSql, maintenanceRecordSelectSql } from "./cemeteryMaintenanceQueries.mjs";
import { toMaintenanceRecord } from "./cemeteryMappers.mjs";
import { resolveCemeteryMutationTargets } from "./cemeteryMutationTargets.mjs";

export async function createMaintenanceRecord(pool, cemeteryId, record, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });

    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const targets = await resolveCemeteryMutationTargets(client, cemeteryId, record);
    if (!targets) {
      await client.query("ROLLBACK");
      return undefined;
    }
    const { gravesiteUuid, headstoneUuid } = targets;

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
