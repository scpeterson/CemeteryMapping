import { withAuditContext } from "../auditContext.mjs";
import { validConfidence, validEvidenceTargetTypes, validEvidenceStatuses } from "./normalization.mjs";
import { toEvidenceLink } from "./reviewMapping.mjs";

export async function saveNorthHillsOcrEvidenceLink(pool, entryId, evidence, { actorUser } = {}) {
  const targetType = String(evidence?.targetType ?? "").trim();
  const targetId = String(evidence?.targetId ?? "").trim();
  const status = String(evidence?.status ?? "").trim();
  const confidence = String(evidence?.confidence ?? "review").trim() || "review";
  const notes = String(evidence?.notes ?? "").trim();

  if (!validEvidenceTargetTypes.has(targetType)) throw new Error(`Unsupported North Hills evidence target type: ${targetType}`);
  if (!validEvidenceStatuses.has(status)) throw new Error(`Unsupported North Hills evidence status: ${status}`);
  if (!validConfidence.has(confidence)) throw new Error(`Unsupported North Hills evidence confidence: ${confidence}`);

  const table = targetType === "headstone" ? "north_hills_ocr_entry_headstone_links" : "north_hills_ocr_entry_gravesite_links";
  const targetColumn = targetType === "headstone" ? "headstone_uuid" : "gravesite_uuid";

  const result = await withAuditContext(pool, { actorUser, reason: `North Hills OCR ${status} ${targetType}` }, (client) =>
    client.query(
      `
        INSERT INTO ${table} (
          entry_id,
          ${targetColumn},
          status,
          confidence,
          notes,
          reviewed_by_app_user_id,
          reviewed_by_external_subject,
          reviewed_by_email
        )
        VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8)
        ON CONFLICT (entry_id, ${targetColumn})
        DO UPDATE SET
          status = EXCLUDED.status,
          confidence = EXCLUDED.confidence,
          notes = EXCLUDED.notes,
          reviewed_by_app_user_id = EXCLUDED.reviewed_by_app_user_id,
          reviewed_by_external_subject = EXCLUDED.reviewed_by_external_subject,
          reviewed_by_email = EXCLUDED.reviewed_by_email,
          reviewed_at = now()
        RETURNING
          id::text,
          entry_id::text,
          '${targetType}' AS target_type,
          ${targetColumn}::text AS target_id,
          status,
          confidence,
          notes,
          reviewed_by_email,
          reviewed_at
      `,
      [entryId, targetId, status, confidence, notes, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
    ),
  );

  return result.rows[0] ? toEvidenceLink(result.rows[0]) : undefined;
}

export async function deleteNorthHillsOcrEvidenceLink(pool, entryId, evidence, { actorUser } = {}) {
  const targetType = String(evidence?.targetType ?? "").trim();
  const targetId = String(evidence?.targetId ?? "").trim();

  if (!validEvidenceTargetTypes.has(targetType)) throw new Error(`Unsupported North Hills evidence target type: ${targetType}`);
  if (!targetId) throw new Error("A North Hills evidence target is required.");

  const table = targetType === "headstone" ? "north_hills_ocr_entry_headstone_links" : "north_hills_ocr_entry_gravesite_links";
  const targetColumn = targetType === "headstone" ? "headstone_uuid" : "gravesite_uuid";

  const result = await withAuditContext(pool, { actorUser, reason: `North Hills OCR unlink ${targetType}` }, (client) =>
    client.query(
      `
        DELETE FROM ${table}
        WHERE entry_id = $1
          AND ${targetColumn} = $2
        RETURNING
          id::text,
          entry_id::text,
          '${targetType}' AS target_type,
          ${targetColumn}::text AS target_id,
          status,
          confidence,
          notes,
          reviewed_by_email,
          reviewed_at
      `,
      [entryId, targetId],
    ),
  );

  return result.rows[0] ? toEvidenceLink(result.rows[0]) : undefined;
}
