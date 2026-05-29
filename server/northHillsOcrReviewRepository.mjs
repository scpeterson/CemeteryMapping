const validConfidence = new Set(["high", "medium", "low", "review"]);
const validStatuses = new Set(["staged", "reviewed", "promoted", "rejected"]);

function compact(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
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
    candidateMatches: row.candidate_matches ?? [],
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
    values.push(`%${query.toLowerCase()}%`);
    where.push(`(
      lower(coalesce(entry.name_text, '')) LIKE $${values.length}
      OR lower(coalesce(entry.raw_text, '')) LIKE $${values.length}
      OR lower(coalesce(entry.inscription_text, '')) LIKE $${values.length}
    )`);
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
        COALESCE(matches.candidate_matches, '[]'::jsonb) AS candidate_matches
      FROM north_hills_ocr_entries entry
      LEFT JOIN LATERAL (
        SELECT count(*) AS candidate_match_count,
               jsonb_agg(
                 jsonb_build_object(
                   'burialId', candidate.burial_id,
                   'gravesiteId', candidate.gravesite_id,
                   'sectionId', candidate.section_id,
                   'fullName', candidate.full_name,
                   'birthDate', candidate.birth_date,
                   'deathDate', candidate.death_date,
                   'score', candidate.score,
                   'notes', candidate.notes
                 )
                 ORDER BY candidate.score DESC, candidate.full_name
               ) AS candidate_matches
        FROM (
          SELECT
            burial.id::text AS burial_id,
            gravesite.gravesite_id,
            gravesite.section_id,
            burial.full_name,
            burial.birth_date,
            burial.death_date,
            burial.notes,
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
                THEN 2 ELSE 0
              END
            ) AS score
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
          ORDER BY score DESC, burial.full_name
          LIMIT 5
        ) candidate
      ) matches ON true
      WHERE ${where.join("\n        AND ")}
      ORDER BY
        CASE entry.parse_confidence
          WHEN 'review' THEN 0
          WHEN 'low' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        entry.source_page_number NULLS LAST,
        entry.source_line_start,
        entry.id
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
