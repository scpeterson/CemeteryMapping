import { withAuditContext } from "../auditContext.mjs";
import { normalizeNullableInteger, normalizeStringArray, normalizeIntegerArray, normalizeSourceFactInput, normalizeObservationInput, validConfidence, validStatuses } from "./normalization.mjs";
import { toEntry } from "./reviewMapping.mjs";

export async function updateNorthHillsOcrEntry(pool, entryId, entryUpdate = {}, { actorUser, reason, allowedCemeteryIds } = {}) {
  const sourcePageNumber = normalizeNullableInteger(entryUpdate.sourcePageNumber);
  const sourceLineStart = normalizeNullableInteger(entryUpdate.sourceLineStart);
  const sourceLineEnd = normalizeNullableInteger(entryUpdate.sourceLineEnd);
  const parsedRowNumber = normalizeNullableInteger(entryUpdate.parsedRowNumber);
  const parsedPositionNumber = normalizeNullableInteger(entryUpdate.parsedPositionNumber);
  const parseConfidence = String(entryUpdate.parseConfidence ?? "review").trim() || "review";
  const status = String(entryUpdate.status ?? "staged").trim() || "staged";
  const parsedMarkerScope = String(entryUpdate.parsedMarkerScope ?? "").trim() || null;
  const surnames = normalizeStringArray(entryUpdate.surnames);
  const parsedYears = normalizeIntegerArray(entryUpdate.parsedYears);
  const parseNotes = normalizeStringArray(entryUpdate.parseNotes);
  const facts = Array.isArray(entryUpdate.sourceFacts) ? entryUpdate.sourceFacts.map(normalizeSourceFactInput) : [];
  const observations = Array.isArray(entryUpdate.observations) ? entryUpdate.observations.map(normalizeObservationInput) : [];

  if (!sourceLineStart || !sourceLineEnd || sourceLineEnd < sourceLineStart) throw new Error("North Hills source lines are required and must be ordered.");
  if (!validConfidence.has(parseConfidence)) throw new Error(`Unsupported North Hills parse confidence: ${parseConfidence}`);
  if (!validStatuses.has(status)) throw new Error(`Unsupported North Hills entry status: ${status}`);
  if (parsedMarkerScope && !["single", "couple", "monolith", "unknown"].includes(parsedMarkerScope)) throw new Error(`Unsupported North Hills marker scope: ${parsedMarkerScope}`);

  const result = await withAuditContext(pool, { actorUser, reason: reason || "Edit North Hills OCR entry" }, async (client) => {
    const existingResult = await client.query(
      `
        SELECT id, cemetery_id
        FROM north_hills_ocr_entries
        WHERE id = $1
        FOR UPDATE
      `,
      [entryId],
    );
    const existing = existingResult.rows[0];
    if (!existing) return { rows: [] };
    if (Array.isArray(allowedCemeteryIds) && existing.cemetery_id && !allowedCemeteryIds.includes(String(existing.cemetery_id))) {
      return { rows: [{ forbidden: true }] };
    }

    const updatedEntry = await client.query(
      `
        UPDATE north_hills_ocr_entries
        SET
          source_page_number = $2,
          source_line_start = $3,
          source_line_end = $4,
          raw_text = $5,
          name_text = NULLIF($6, ''),
          surnames = $7,
          parsed_section_name = NULLIF($8, ''),
          parsed_row_number = $9,
          parsed_position_number = $10,
          parsed_marker_scope = $11,
          marker_type_text = NULLIF($12, ''),
          material_text = NULLIF($13, ''),
          condition_text = NULLIF($14, ''),
          inscription_text = NULLIF($15, ''),
          parsed_years = $16,
          parse_confidence = $17,
          parse_notes = $18,
          status = $19,
          source_entry = $20,
          updated_at = now()
        WHERE id = $1
        RETURNING id
      `,
      [
        entryId,
        sourcePageNumber,
        sourceLineStart,
        sourceLineEnd,
        String(entryUpdate.rawText ?? "").trim(),
        String(entryUpdate.nameText ?? "").trim(),
        surnames,
        String(entryUpdate.parsedSectionName ?? "").trim().toUpperCase(),
        parsedRowNumber,
        parsedPositionNumber,
        parsedMarkerScope,
        String(entryUpdate.markerTypeText ?? "").trim(),
        String(entryUpdate.materialText ?? "").trim(),
        String(entryUpdate.conditionText ?? "").trim(),
        String(entryUpdate.inscriptionText ?? "").trim(),
        parsedYears,
        parseConfidence,
        parseNotes,
        status,
        entryUpdate.sourceEntry && typeof entryUpdate.sourceEntry === "object" ? entryUpdate.sourceEntry : {},
      ],
    );
    if (!updatedEntry.rows[0]) return { rows: [] };

    const keptFactIds = facts.filter((fact) => fact.id).map((fact) => fact.id);
    await client.query(
      `
        DELETE FROM north_hills_ocr_source_facts
        WHERE entry_id = $1
          AND ($2::uuid[] = '{}'::uuid[] OR NOT (id = ANY($2::uuid[])))
      `,
      [entryId, keptFactIds],
    );

    for (const fact of facts) {
      if (fact.id) {
        await client.query(
          `
            UPDATE north_hills_ocr_source_facts
            SET
              source_code = $3,
              source_label = $4,
              fact_type = $5,
              fact_value = $6,
              fact_date = $7,
              raw_text = $8,
              confidence = $9,
              status = $10,
              review_notes = $11,
              updated_at = now()
            WHERE id = $2
              AND entry_id = $1
          `,
          [entryId, fact.id, fact.sourceCode, fact.sourceLabel, fact.factType, fact.factValue, fact.factDate, fact.rawText, fact.confidence, fact.status, fact.reviewNotes],
        );
      } else {
        await client.query(
          `
            INSERT INTO north_hills_ocr_source_facts (
              entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence, status, review_notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (entry_id, source_code, fact_type, fact_value)
            DO UPDATE SET
              source_label = EXCLUDED.source_label,
              fact_date = EXCLUDED.fact_date,
              raw_text = EXCLUDED.raw_text,
              confidence = EXCLUDED.confidence,
              status = EXCLUDED.status,
              review_notes = EXCLUDED.review_notes,
              updated_at = now()
          `,
          [entryId, fact.sourceCode, fact.sourceLabel, fact.factType, fact.factValue, fact.factDate, fact.rawText, fact.confidence, fact.status, fact.reviewNotes],
        );
      }
    }

    const keptObservationIds = observations.filter((observation) => observation.id).map((observation) => observation.id);
    await client.query(
      `
        DELETE FROM north_hills_ocr_entry_observations
        WHERE entry_id = $1
          AND ($2::uuid[] = '{}'::uuid[] OR NOT (id = ANY($2::uuid[])))
      `,
      [entryId, keptObservationIds],
    );

    for (const observation of observations) {
      if (observation.id) {
        await client.query(
          `
            UPDATE north_hills_ocr_entry_observations
            SET
              observation_type = $3,
              observation_text = $4,
              status = $5,
              updated_at = now()
            WHERE id = $2
              AND entry_id = $1
          `,
          [entryId, observation.id, observation.observationType, observation.observationText, observation.status],
        );
      } else {
        await client.query(
          `
            INSERT INTO north_hills_ocr_entry_observations (entry_id, observation_type, observation_text, status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (entry_id, observation_type, observation_text)
            DO UPDATE SET
              status = EXCLUDED.status,
              updated_at = now()
          `,
          [entryId, observation.observationType, observation.observationText, observation.status],
        );
      }
    }

    return client.query(
      `
        SELECT
          entry.id::text,
          entry.batch_id::text,
          entry.source_page_number,
          entry.source_page_index,
          entry.source_line_start,
          entry.source_line_end,
          entry.name_text,
          entry.surnames,
          entry.raw_text,
          entry.parsed_section_name,
          entry.parsed_row_number,
          entry.parsed_position_number,
          entry.parsed_marker_scope,
          entry.marker_type_text,
          entry.material_text,
          entry.condition_text,
          entry.inscription_text,
          entry.parsed_years,
          entry.parse_confidence,
          entry.parse_notes,
          entry.status,
          0 AS candidate_match_count,
          '[]'::jsonb AS candidate_matches,
          COALESCE(source_facts.facts, '[]'::jsonb) AS source_facts,
          COALESCE(observations.observations, '[]'::jsonb) AS observations
        FROM north_hills_ocr_entries entry
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', fact.id::text,
              'entryId', fact.entry_id::text,
              'sourceCode', fact.source_code,
              'sourceLabel', fact.source_label,
              'factType', fact.fact_type,
              'factValue', fact.fact_value,
              'factDate', fact.fact_date,
              'rawText', fact.raw_text,
              'reviewNotes', fact.review_notes,
              'confidence', fact.confidence,
              'status', fact.status,
              'promotedBurialId', fact.promoted_burial_uuid::text,
              'reviewedByEmail', fact.reviewed_by_email,
              'reviewedAt', fact.reviewed_at
            )
            ORDER BY fact.source_code, fact.fact_type, fact.fact_value
          ) AS facts
          FROM north_hills_ocr_source_facts fact
          WHERE fact.entry_id = entry.id
        ) source_facts ON true
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', observation.id::text,
              'entryId', observation.entry_id::text,
              'observationType', observation.observation_type,
              'observationText', observation.observation_text,
              'status', observation.status,
              'createdAt', observation.created_at,
              'updatedAt', observation.updated_at
            )
            ORDER BY observation.observation_type, observation.created_at, observation.id
          ) AS observations
          FROM north_hills_ocr_entry_observations observation
          WHERE observation.entry_id = entry.id
        ) observations ON true
        WHERE entry.id = $1
      `,
      [entryId],
    );
  });

  if (result.rows[0]?.forbidden) return { forbidden: true };
  return result.rows[0] ? toEntry(result.rows[0]) : undefined;
}

