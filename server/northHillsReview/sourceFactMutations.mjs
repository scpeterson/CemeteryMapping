import { withAuditContext } from "../auditContext.mjs";

const validConfidence = new Set(["high", "medium", "low", "review"]);
const validSourceFactStatuses = new Set(["staged", "reviewed", "promoted", "rejected"]);

function toSourceFact(row) {
  return {
    id: row.id,
    entryId: row.entry_id,
    sourceCode: row.source_code,
    sourceLabel: row.source_label,
    factType: row.fact_type,
    factValue: row.fact_value,
    factDate: row.fact_date?.toISOString?.().slice(0, 10) ?? row.fact_date,
    rawText: row.raw_text ?? "",
    reviewNotes: row.review_notes ?? "",
    confidence: row.confidence,
    status: row.status,
    promotedBurialId: row.promoted_burial_uuid ?? "",
    reviewedByEmail: row.reviewed_by_email ?? "",
    reviewedAt: row.reviewed_at,
  };
}

export async function reviewNorthHillsSourceFact(pool, factId, review = {}, { actorUser } = {}) {
  const status = String(review?.status ?? "").trim();
  const confidence = String(review?.confidence ?? "review").trim() || "review";
  const notes = String(review?.notes ?? "").trim();
  if (!validSourceFactStatuses.has(status)) throw new Error(`Unsupported North Hills source fact status: ${status}`);
  if (!validConfidence.has(confidence)) throw new Error(`Unsupported North Hills source fact confidence: ${confidence}`);
  if (status === "promoted") throw new Error("Use the promote endpoint to promote a North Hills source fact.");

  const result = await withAuditContext(pool, { actorUser, reason: `North Hills source fact ${status}` }, (client) => client.query(
    `UPDATE north_hills_ocr_source_facts
     SET status=$2, confidence=$3, review_notes=COALESCE(NULLIF($4, ''), review_notes),
         reviewed_by_app_user_id=$5, reviewed_by_external_subject=$6, reviewed_by_email=$7, reviewed_at=now()
     WHERE id=$1
     RETURNING id::text, entry_id::text, source_code, source_label, fact_type, fact_value, fact_date,
       raw_text, review_notes, confidence, status, promoted_burial_uuid::text, reviewed_by_email, reviewed_at`,
    [factId, status, confidence, notes, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
  ));
  return result.rows[0] ? toSourceFact(result.rows[0]) : undefined;
}

export async function promoteNorthHillsSourceFact(pool, factId, promotion = {}, { actorUser, reason } = {}) {
  const burialId = String(promotion?.burialId ?? "").trim();
  const notes = String(promotion?.notes ?? "").trim();
  if (!burialId) throw new Error("A burial is required to promote a North Hills source fact.");

  const result = await withAuditContext(pool, { actorUser, reason: reason || "Promote North Hills source fact to burial" }, async (client) => {
    const factResult = await client.query(
      `SELECT id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, review_notes
       FROM north_hills_ocr_source_facts WHERE id=$1 FOR UPDATE`, [factId],
    );
    const fact = factResult.rows[0];
    if (!fact) return { rows: [] };
    if (fact.fact_type !== "death_date" || !fact.fact_date) throw new Error("Only North Hills death date source facts can be promoted to burial dates.");
    const isoDeathDate = fact.fact_date.toISOString?.().slice(0, 10) ?? String(fact.fact_date);
    const burialUpdate = await client.query(
      `UPDATE burials SET death_date=$2::date, death_date_text=$2,
         notes=CASE WHEN NULLIF($3, '') IS NULL THEN notes WHEN COALESCE(notes, '')='' THEN $3
           WHEN notes ILIKE '%' || $3 || '%' THEN notes ELSE notes || E'\n' || $3 END
       WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [burialId, isoDeathDate, notes],
    );
    if (!burialUpdate.rows[0]) throw new Error("Burial not found for North Hills source fact promotion.");
    return client.query(
      `UPDATE north_hills_ocr_source_facts
       SET status='promoted', confidence=CASE WHEN confidence='review' THEN 'high' ELSE confidence END,
         promoted_burial_uuid=$2, reviewed_by_app_user_id=$3, reviewed_by_external_subject=$4,
         reviewed_by_email=$5, reviewed_at=now()
       WHERE id=$1
       RETURNING id::text, entry_id::text, source_code, source_label, fact_type, fact_value, fact_date,
         raw_text, review_notes, confidence, status, promoted_burial_uuid::text, reviewed_by_email, reviewed_at`,
      [factId, burialId, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
    );
  });
  return result.rows[0] ? toSourceFact(result.rows[0]) : undefined;
}
