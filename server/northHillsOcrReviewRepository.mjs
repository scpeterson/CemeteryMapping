import { withAuditContext } from "./auditContext.mjs";

const validConfidence = new Set(["high", "medium", "low", "review"]);
const validStatuses = new Set(["staged", "reviewed", "promoted", "rejected"]);
const validSorts = new Set(["review", "page"]);
const validEvidenceTargetTypes = new Set(["headstone", "gravesite"]);
const validEvidenceStatuses = new Set(["linked", "rejected", "needs_field_check"]);
const validSourceFactStatuses = new Set(["staged", "reviewed", "promoted", "rejected"]);
const validObservationTypes = new Set(["plot_marker", "gap", "marker_observation", "entry_note"]);
const validObservationStatuses = new Set(["staged", "reviewed", "rejected"]);

function compact(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function displayName(value) {
  return String(value ?? "")
    .replace(/^[\s"“”]+|[\s"“”]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function toCandidateMatch(candidate) {
  return {
    ...candidate,
    fullName: displayName(candidate.fullName),
  };
}

function normalizeLimit(value) {
  const limit = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(limit, 25), 250);
}

function toBatch(row) {
  return {
    id: row.id,
    cemeteryName: row.cemetery_name ?? "",
    sourceName: row.source_name,
    importedBy: row.imported_by ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    entryCount: Number(row.entry_count ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    lowConfidenceCount: Number(row.low_confidence_count ?? 0),
    matchedCount: Number(row.matched_count ?? 0),
  };
}

function toSummary(row) {
  return {
    parseConfidence: row.parse_confidence,
    status: row.status,
    count: Number(row.count ?? 0),
  };
}

function toEntry(row) {
  return {
    id: row.id,
    batchId: row.batch_id,
    sourcePageNumber: row.source_page_number,
    sourcePageIndex: row.source_page_index,
    sourceLineStart: row.source_line_start,
    sourceLineEnd: row.source_line_end,
    nameText: row.name_text ?? "",
    surnames: row.surnames ?? [],
    rawText: row.raw_text ?? "",
    parsedSectionName: row.parsed_section_name ?? "",
    parsedRowNumber: row.parsed_row_number,
    parsedPositionNumber: row.parsed_position_number,
    parsedMarkerScope: row.parsed_marker_scope ?? "",
    markerTypeText: row.marker_type_text ?? "",
    materialText: row.material_text ?? "",
    conditionText: row.condition_text ?? "",
    inscriptionText: row.inscription_text ?? "",
    parsedYears: row.parsed_years ?? [],
    parseConfidence: row.parse_confidence,
    parseNotes: row.parse_notes ?? [],
    status: row.status,
    candidateMatchCount: Number(row.candidate_match_count ?? 0),
    candidateMatches: (row.candidate_matches ?? []).map(toCandidateMatch),
    sourceFacts: row.source_facts ?? [],
    observations: row.observations ?? [],
  };
}

function toEvidenceLink(row) {
  return {
    id: row.id,
    entryId: row.entry_id,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    confidence: row.confidence,
    notes: row.notes ?? "",
    reviewedByEmail: row.reviewed_by_email ?? "",
    reviewedAt: row.reviewed_at,
  };
}

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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeIntegerArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number.parseInt(String(item ?? ""), 10)).filter((item) => Number.isFinite(item)))].sort((left, right) => left - right);
}

function normalizeNullableInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) throw new Error("North Hills location numbers must be integers.");
  return number;
}

function normalizeSourceFactInput(fact) {
  const sourceCode = String(fact?.sourceCode ?? "").trim().toUpperCase();
  const factType = String(fact?.factType ?? "").trim();
  const factValue = String(fact?.factValue ?? "").trim();
  const confidence = String(fact?.confidence ?? "review").trim() || "review";
  const status = String(fact?.status ?? "staged").trim() || "staged";
  if (!["CR", "CRG"].includes(sourceCode)) throw new Error("Source fact code must be CR or CRG.");
  if (!["death_date", "middle_initial", "age_at_death", "note"].includes(factType)) throw new Error(`Unsupported North Hills source fact type: ${factType}`);
  if (!factValue) throw new Error("Source fact value is required.");
  if (!validConfidence.has(confidence)) throw new Error(`Unsupported North Hills source fact confidence: ${confidence}`);
  if (!validSourceFactStatuses.has(status)) throw new Error(`Unsupported North Hills source fact status: ${status}`);
  return {
    id: String(fact?.id ?? "").trim() || null,
    sourceCode,
    sourceLabel: sourceCode === "CRG" ? "Church Records in German" : "Church Records",
    factType,
    factValue,
    factDate: String(fact?.factDate ?? "").trim() || null,
    rawText: String(fact?.rawText ?? "").trim() || `${sourceCode}: ${factValue}`,
    confidence,
    status,
    reviewNotes: String(fact?.reviewNotes ?? "").trim() || null,
  };
}

function normalizeObservationInput(observation) {
  const observationType = String(observation?.observationType ?? "").trim();
  const observationText = String(observation?.observationText ?? "").trim();
  const status = String(observation?.status ?? "staged").trim() || "staged";
  if (!validObservationTypes.has(observationType)) throw new Error(`Unsupported North Hills observation type: ${observationType}`);
  if (!observationText) throw new Error("Observation text is required.");
  if (!validObservationStatuses.has(status)) throw new Error(`Unsupported North Hills observation status: ${status}`);
  return {
    id: String(observation?.id ?? "").trim() || null,
    observationType,
    observationText,
    status,
  };
}

export async function listNorthHillsOcrReview(pool, filters = {}) {
  const batchResult = await pool.query(`
    SELECT
      batch.id::text,
      cemetery.name AS cemetery_name,
      batch.source_name,
      batch.imported_by,
      batch.notes,
      batch.created_at,
      count(entry.id) AS entry_count,
      count(entry.id) FILTER (WHERE entry.parse_confidence = 'review') AS review_count,
      count(entry.id) FILTER (WHERE entry.parse_confidence = 'low') AS low_confidence_count,
      count(entry.id) FILTER (WHERE matched.candidate_count > 0) AS matched_count
    FROM north_hills_ocr_import_batches batch
    LEFT JOIN cemeteries cemetery ON cemetery.id = batch.cemetery_id
    LEFT JOIN north_hills_ocr_entries entry ON entry.batch_id = batch.id
    LEFT JOIN LATERAL (
      SELECT count(*) AS candidate_count
      FROM burials burial
      JOIN gravesites gravesite ON gravesite.id = burial.gravesite_uuid
      WHERE gravesite.cemetery_id = entry.cemetery_id
        AND burial.deleted_at IS NULL
        AND (
          (entry.source_page_number IS NOT NULL AND burial.notes ILIKE ('%' || 'North Hills Genealogists page: ' || entry.source_page_number::text || '%'))
          OR EXISTS (
            SELECT 1
            FROM unnest(entry.surnames) AS surname(value)
            WHERE lower(coalesce(burial.full_name, burial.last_name, '')) LIKE '%' || lower(surname.value) || '%'
          )
        )
      LIMIT 1
    ) matched ON true
    GROUP BY batch.id, cemetery.name
    ORDER BY batch.created_at DESC, batch.id
  `);

  const batches = batchResult.rows.map(toBatch);
  const selectedBatchId = compact(filters.batchId) ?? batches[0]?.id;
  if (!selectedBatchId) return { batches, selectedBatchId: "", summary: [], entries: [] };

  const where = ["entry.batch_id = $1"];
  const values = [selectedBatchId];
  const confidence = compact(filters.confidence);
  const status = compact(filters.status);
  const section = compact(filters.section);
  const query = compact(filters.q);
  let sort = validSorts.has(compact(filters.sort)) ? compact(filters.sort) : "review";

  if (confidence && validConfidence.has(confidence)) {
    values.push(confidence);
    where.push(`entry.parse_confidence = $${values.length}`);
  }

  if (status && validStatuses.has(status)) {
    values.push(status);
    where.push(`entry.status = $${values.length}`);
  }

  if (section) {
    values.push(section.toUpperCase());
    where.push(`upper(coalesce(entry.parsed_section_name, '')) = $${values.length}`);
  }

  if (query) {
    const pageNumber = /^\d+$/u.test(query) ? Number.parseInt(query, 10) : undefined;
    if (pageNumber) {
      values.push(pageNumber);
      where.push(`entry.source_page_number = $${values.length}`);
      sort = "page";
    } else {
      values.push(`%${query.toLowerCase()}%`);
      where.push(`(
        lower(coalesce(entry.name_text, '')) LIKE $${values.length}
        OR lower(coalesce(entry.raw_text, '')) LIKE $${values.length}
        OR lower(coalesce(entry.inscription_text, '')) LIKE $${values.length}
      )`);
    }
  }

  const limit = normalizeLimit(filters.limit);
  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  const summaryResult = await pool.query(
    `
      SELECT entry.parse_confidence, entry.status, count(*) AS count
      FROM north_hills_ocr_entries entry
      WHERE entry.batch_id = $1
      GROUP BY entry.parse_confidence, entry.status
      ORDER BY entry.parse_confidence, entry.status
    `,
    [selectedBatchId],
  );

  const orderBy =
    sort === "page"
      ? `
        entry.source_page_number NULLS LAST,
        entry.source_page_index,
        entry.source_line_start,
        entry.id
      `
      : `
        CASE entry.parse_confidence
          WHEN 'review' THEN 0
          WHEN 'low' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        entry.source_page_number NULLS LAST,
        entry.source_line_start,
        entry.id
      `;

  const entriesResult = await pool.query(
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
        COALESCE(matches.candidate_match_count, 0) AS candidate_match_count,
        COALESCE(matches.candidate_matches, '[]'::jsonb) AS candidate_matches,
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
          ORDER BY
            CASE fact.fact_type
              WHEN 'death_date' THEN 0
              WHEN 'middle_initial' THEN 1
              WHEN 'age_at_death' THEN 2
              ELSE 3
            END,
            fact.source_code,
            fact.fact_value
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
      LEFT JOIN LATERAL (
        SELECT count(*) AS candidate_match_count,
               jsonb_agg(
                 jsonb_build_object(
                   'burialId', candidate.burial_id,
                   'gravesiteUuid', candidate.gravesite_uuid,
                   'gravesiteId', candidate.gravesite_id,
                   'sectionId', candidate.section_id,
                   'fullName', candidate.full_name,
                   'birthDate', candidate.birth_date,
                   'deathDate', candidate.death_date,
                   'score', candidate.score,
                   'notes', candidate.notes,
                   'gravesiteEvidence', candidate.gravesite_evidence,
                   'headstoneCandidates', candidate.headstone_candidates
                 )
                 ORDER BY candidate.score DESC, candidate.full_name
               ) AS candidate_matches
        FROM (
          SELECT
            burial.id::text AS burial_id,
            gravesite.id::text AS gravesite_uuid,
            gravesite.gravesite_id,
            gravesite.section_id,
            burial.full_name,
            COALESCE(burial.birth_date_text, burial.birth_date::text) AS birth_date,
            COALESCE(burial.death_date_text, burial.death_date::text) AS death_date,
            burial.notes,
            COALESCE(gravesite_evidence.evidence, '[]'::jsonb) AS gravesite_evidence,
            COALESCE(headstone_candidates.candidates, '[]'::jsonb) AS headstone_candidates,
            (
              CASE
                WHEN entry.source_page_number IS NOT NULL
                  AND burial.notes ILIKE ('%' || 'North Hills Genealogists page: ' || entry.source_page_number::text || '%')
                THEN 4 ELSE 0
              END
              +
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM unnest(entry.surnames) AS surname(value)
                  WHERE lower(coalesce(burial.full_name, burial.last_name, '')) LIKE '%' || lower(surname.value) || '%'
                )
                THEN 3 ELSE 0
              END
              +
              CASE
                WHEN (EXTRACT(YEAR FROM burial.birth_date)::int = ANY(entry.parsed_years))
                  OR (EXTRACT(YEAR FROM burial.death_date)::int = ANY(entry.parsed_years))
                  OR (substring(burial.birth_date_text from '([0-9]{4})')::int = ANY(entry.parsed_years))
                  OR (substring(burial.death_date_text from '([0-9]{4})')::int = ANY(entry.parsed_years))
                THEN 2 ELSE 0
              END
            ) AS score
          FROM burials burial
          JOIN gravesites gravesite ON gravesite.id = burial.gravesite_uuid
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', gravesite_link.id::text,
                'status', gravesite_link.status,
                'confidence', gravesite_link.confidence,
                'notes', gravesite_link.notes,
                'reviewedByEmail', gravesite_link.reviewed_by_email,
                'reviewedAt', gravesite_link.reviewed_at
              )
              ORDER BY gravesite_link.reviewed_at DESC, gravesite_link.id
            ) AS evidence
            FROM north_hills_ocr_entry_gravesite_links gravesite_link
            WHERE gravesite_link.entry_id = entry.id
              AND gravesite_link.gravesite_uuid = gravesite.id
          ) gravesite_evidence ON true
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', candidate_headstone.id::text,
                'headstoneId', candidate_headstone.headstone_id,
                'evidence', COALESCE(headstone_evidence.evidence, '[]'::jsonb)
              )
              ORDER BY candidate_headstone.headstone_id, candidate_headstone.id
            ) AS candidates
            FROM headstones candidate_headstone
            LEFT JOIN headstone_gravesites candidate_headstone_grave
              ON candidate_headstone_grave.headstone_uuid = candidate_headstone.id
             AND candidate_headstone_grave.deleted_at IS NULL
            LEFT JOIN headstone_burials candidate_headstone_burial
              ON candidate_headstone_burial.headstone_uuid = candidate_headstone.id
             AND candidate_headstone_burial.deleted_at IS NULL
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', headstone_link.id::text,
                  'status', headstone_link.status,
                  'confidence', headstone_link.confidence,
                  'notes', headstone_link.notes,
                  'reviewedByEmail', headstone_link.reviewed_by_email,
                  'reviewedAt', headstone_link.reviewed_at
                )
                ORDER BY headstone_link.reviewed_at DESC, headstone_link.id
              ) AS evidence
              FROM north_hills_ocr_entry_headstone_links headstone_link
              WHERE headstone_link.entry_id = entry.id
                AND headstone_link.headstone_uuid = candidate_headstone.id
            ) headstone_evidence ON true
            WHERE candidate_headstone.deleted_at IS NULL
              AND (
                candidate_headstone.gravesite_uuid = gravesite.id
                OR candidate_headstone_grave.gravesite_uuid = gravesite.id
                OR candidate_headstone_burial.burial_uuid = burial.id
              )
          ) headstone_candidates ON true
          WHERE gravesite.cemetery_id = entry.cemetery_id
            AND burial.deleted_at IS NULL
            AND (
              (entry.source_page_number IS NOT NULL AND burial.notes ILIKE ('%' || 'North Hills Genealogists page: ' || entry.source_page_number::text || '%'))
              OR EXISTS (
                SELECT 1
                FROM unnest(entry.surnames) AS surname(value)
                WHERE lower(coalesce(burial.full_name, burial.last_name, '')) LIKE '%' || lower(surname.value) || '%'
              )
            )
          ORDER BY score DESC, burial.full_name
          LIMIT 5
        ) candidate
      ) matches ON true
      WHERE ${where.join("\n        AND ")}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder}
    `,
    values,
  );

  return {
    batches,
    selectedBatchId,
    summary: summaryResult.rows.map(toSummary),
    entries: entriesResult.rows.map(toEntry),
  };
}

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

export async function reviewNorthHillsSourceFact(pool, factId, review = {}, { actorUser } = {}) {
  const status = String(review?.status ?? "").trim();
  const confidence = String(review?.confidence ?? "review").trim() || "review";
  const notes = String(review?.notes ?? "").trim();

  if (!validSourceFactStatuses.has(status)) throw new Error(`Unsupported North Hills source fact status: ${status}`);
  if (!validConfidence.has(confidence)) throw new Error(`Unsupported North Hills source fact confidence: ${confidence}`);
  if (status === "promoted") throw new Error("Use the promote endpoint to promote a North Hills source fact.");

  const result = await withAuditContext(pool, { actorUser, reason: `North Hills source fact ${status}` }, (client) =>
    client.query(
      `
        UPDATE north_hills_ocr_source_facts
        SET
          status = $2,
          confidence = $3,
          review_notes = COALESCE(NULLIF($4, ''), review_notes),
          reviewed_by_app_user_id = $5,
          reviewed_by_external_subject = $6,
          reviewed_by_email = $7,
          reviewed_at = now()
        WHERE id = $1
        RETURNING
          id::text,
          entry_id::text,
          source_code,
          source_label,
          fact_type,
          fact_value,
          fact_date,
          raw_text,
          review_notes,
          confidence,
          status,
          promoted_burial_uuid::text,
          reviewed_by_email,
          reviewed_at
      `,
      [factId, status, confidence, notes, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
    ),
  );

  return result.rows[0] ? toSourceFact(result.rows[0]) : undefined;
}

export async function promoteNorthHillsSourceFact(pool, factId, promotion = {}, { actorUser, reason } = {}) {
  const burialId = String(promotion?.burialId ?? "").trim();
  const notes = String(promotion?.notes ?? "").trim();
  if (!burialId) throw new Error("A burial is required to promote a North Hills source fact.");

  const result = await withAuditContext(pool, { actorUser, reason: reason || "Promote North Hills source fact to burial" }, async (client) => {
    const factResult = await client.query(
      `
        SELECT
          id,
          source_code,
          source_label,
          fact_type,
          fact_value,
          fact_date,
          raw_text,
          review_notes
        FROM north_hills_ocr_source_facts
        WHERE id = $1
        FOR UPDATE
      `,
      [factId],
    );
    const fact = factResult.rows[0];
    if (!fact) return { rows: [] };
    if (fact.fact_type !== "death_date" || !fact.fact_date) throw new Error("Only North Hills death date source facts can be promoted to burial dates.");

    const isoDeathDate = fact.fact_date.toISOString?.().slice(0, 10) ?? String(fact.fact_date);
    const burialUpdate = await client.query(
      `
        UPDATE burials
        SET
          death_date = $2::date,
          death_date_text = $2,
          notes = CASE
            WHEN NULLIF($3, '') IS NULL THEN notes
            WHEN COALESCE(notes, '') = '' THEN $3
            WHEN notes ILIKE '%' || $3 || '%' THEN notes
            ELSE notes || E'\n' || $3
          END
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id
      `,
      [burialId, isoDeathDate, notes],
    );
    if (!burialUpdate.rows[0]) throw new Error("Burial not found for North Hills source fact promotion.");

    return client.query(
      `
        UPDATE north_hills_ocr_source_facts
        SET
          status = 'promoted',
          confidence = CASE WHEN confidence = 'review' THEN 'high' ELSE confidence END,
          promoted_burial_uuid = $2,
          reviewed_by_app_user_id = $3,
          reviewed_by_external_subject = $4,
          reviewed_by_email = $5,
          reviewed_at = now()
        WHERE id = $1
        RETURNING
          id::text,
          entry_id::text,
          source_code,
          source_label,
          fact_type,
          fact_value,
          fact_date,
          raw_text,
          review_notes,
          confidence,
          status,
          promoted_burial_uuid::text,
          reviewed_by_email,
          reviewed_at
      `,
      [factId, burialId, actorUser?.id ?? null, actorUser?.subject ?? null, actorUser?.email ?? null],
    );
  });

  return result.rows[0] ? toSourceFact(result.rows[0]) : undefined;
}
