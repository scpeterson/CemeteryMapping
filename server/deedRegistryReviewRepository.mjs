const validConfidence = new Set(["high", "medium", "low", "review"]);
const validScopes = new Set(["whole_lot", "multiple_lots", "specific_graves", "grave_count_only", "passage", "section_g_gravesite", "unknown"]);

function compact(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function normalizeLimit(value) {
  const limit = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(limit, 25), 250);
}

function queryTerms(value) {
  return [
    ...new Set(
      String(value ?? "")
        .toLowerCase()
        .split(/[\s,;|/]+/u)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  ].slice(0, 12);
}

function toBatch(row) {
  return {
    id: row.id,
    cemeteryName: row.cemetery_name ?? "",
    sourceName: row.source_name,
    worksheetName: row.worksheet_name ?? "",
    importedBy: row.imported_by ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    entryCount: Number(row.entry_count ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    lowConfidenceCount: Number(row.low_confidence_count ?? 0),
  };
}

function toSummary(row) {
  return {
    ownershipScope: row.ownership_scope,
    parseConfidence: row.parse_confidence,
    count: Number(row.count ?? 0),
  };
}

function toComparisonSummary(row, originalBatch) {
  return {
    originalBatchId: originalBatch?.id ?? "",
    originalBatchLabel: originalBatch ? `${originalBatch.source_name} (${originalBatch.worksheet_name})` : "",
    addedCount: Number(row?.added_count ?? 0),
    changedCount: Number(row?.changed_count ?? 0),
    unchangedCount: Number(row?.unchanged_count ?? 0),
    removedCount: Number(row?.removed_count ?? 0),
  };
}

function toRemovedEntry(row) {
  return {
    id: row.id,
    sourceRowNumber: row.source_row_number,
    ownerDisplayName: row.owner_display_name ?? "",
    rawLotText: row.raw_lot_text ?? "",
    rawSectionText: row.raw_section_text ?? "",
    rawRemarks: row.raw_remarks ?? "",
    parsedLotNumbers: row.parsed_lot_numbers ?? [],
  };
}

function toEntry(row) {
  return {
    id: row.id,
    batchId: row.batch_id,
    sourceRowNumber: row.source_row_number,
    rowType: row.row_type ?? "owner_record",
    ownerDisplayName: row.owner_display_name ?? "",
    rawLotText: row.raw_lot_text ?? "",
    rawSectionText: row.raw_section_text ?? "",
    rawRemarks: row.raw_remarks ?? "",
    deedOnFile: row.deed_on_file ?? "",
    deedRegisterOnFile: row.deed_register_on_file ?? "",
    parsedSectionName: row.parsed_section_name ?? "",
    parsedSectionAlias: row.parsed_section_alias ?? "",
    parsedLotNumbers: row.parsed_lot_numbers ?? [],
    parsedPlotNumbers: row.parsed_plot_numbers ?? [],
    parsedGraveNumbers: row.parsed_grave_numbers ?? [],
    parsedGraveCount: row.parsed_grave_count,
    ownershipScope: row.ownership_scope,
    parseConfidence: row.parse_confidence,
    parseNotes: row.parse_notes ?? [],
    status: row.status,
    allocationCount: Number(row.allocation_count ?? 0),
    relatedInvestigationNotes: row.related_investigation_notes ?? [],
    comparisonStatus: row.comparison_status ?? "",
    originalSourceRowNumber: row.original_source_row_number,
    originalRawLotText: row.original_raw_lot_text ?? "",
    originalRawSectionText: row.original_raw_section_text ?? "",
    originalRawRemarks: row.original_raw_remarks ?? "",
  };
}

export async function listDeedRegistryReview(pool, filters = {}) {
  const batchResult = await pool.query(`
    SELECT
      batch.id::text,
      cemetery.name AS cemetery_name,
      batch.source_name,
      batch.worksheet_name,
      batch.imported_by,
      batch.notes,
      batch.created_at,
      count(entry.id) AS entry_count,
      count(entry.id) FILTER (WHERE entry.parse_confidence = 'review') AS review_count,
      count(entry.id) FILTER (WHERE entry.parse_confidence = 'low') AS low_confidence_count
    FROM deed_registry_import_batches batch
    LEFT JOIN cemeteries cemetery ON cemetery.id = batch.cemetery_id
    LEFT JOIN deed_registry_entries entry ON entry.batch_id = batch.id
    GROUP BY batch.id, cemetery.name
    ORDER BY batch.created_at DESC, batch.id
  `);

  const batches = batchResult.rows.map(toBatch);
  const selectedBatchId = compact(filters.batchId) ?? batches[0]?.id;
  if (!selectedBatchId) return { batches, selectedBatchId: "", summary: [], comparison: null, removedOriginalEntries: [], entries: [] };

  const originalBatchResult = await pool.query(
    `
      SELECT original.id::text, original.source_name, original.worksheet_name, original.created_at
      FROM deed_registry_import_batches selected
      JOIN deed_registry_import_batches original
        ON original.cemetery_id = selected.cemetery_id
       AND original.worksheet_name = 'Original 2017'
       AND original.id <> selected.id
      WHERE selected.id = $1
      ORDER BY original.created_at DESC, original.id
      LIMIT 1
    `,
    [selectedBatchId],
  );
  const originalBatch = originalBatchResult.rows[0] ?? null;

  const where = ["entry.batch_id = $1"];
  const values = [selectedBatchId];
  const confidence = compact(filters.confidence);
  const ownershipScope = compact(filters.ownershipScope);
  const terms = queryTerms(filters.q);

  if (confidence && validConfidence.has(confidence)) {
    values.push(confidence);
    where.push(`entry.parse_confidence = $${values.length}`);
  }

  if (ownershipScope && validScopes.has(ownershipScope)) {
    values.push(ownershipScope);
    where.push(`entry.ownership_scope = $${values.length}`);
  }

  if (terms.length) {
    values.push(terms);
    where.push(`EXISTS (
      SELECT 1
      FROM unnest($${values.length}::text[]) search_terms(term)
      WHERE lower(coalesce(entry.owner_display_name, '')) LIKE '%' || search_terms.term || '%'
        OR lower(coalesce(entry.raw_lot_text, '')) LIKE '%' || search_terms.term || '%'
        OR lower(coalesce(entry.raw_section_text, '')) LIKE '%' || search_terms.term || '%'
        OR lower(coalesce(entry.raw_remarks, '')) LIKE '%' || search_terms.term || '%'
        OR lower(coalesce(entry.deed_on_file, '')) LIKE '%' || search_terms.term || '%'
        OR lower(coalesce(entry.deed_register_on_file, '')) LIKE '%' || search_terms.term || '%'
        OR lower(array_to_string(coalesce(entry.parsed_lot_numbers, '{}'::text[]), ' ')) LIKE '%' || search_terms.term || '%'
        OR lower(array_to_string(coalesce(entry.parsed_plot_numbers, '{}'::text[]), ' ')) LIKE '%' || search_terms.term || '%'
        OR lower(array_to_string(coalesce(entry.parsed_grave_numbers, '{}'::text[]), ' ')) LIKE '%' || search_terms.term || '%'
        OR EXISTS (
          SELECT 1
          FROM deed_registry_import_batches investigated_batch
          JOIN deed_registry_entries owner_entry
            ON owner_entry.batch_id = investigated_batch.id
           AND owner_entry.source_row->>'rowType' = 'owner_record'
          JOIN deed_registry_entries note
            ON note.batch_id = investigated_batch.id
           AND note.source_row->>'rowType' = 'investigation_note'
           AND note.source_row_number > owner_entry.source_row_number
           AND NOT EXISTS (
             SELECT 1
             FROM deed_registry_entries next_owner
             WHERE next_owner.batch_id = investigated_batch.id
               AND next_owner.source_row->>'rowType' = 'owner_record'
               AND next_owner.source_row_number > owner_entry.source_row_number
               AND next_owner.source_row_number < note.source_row_number
           )
          WHERE investigated_batch.worksheet_name = 'Investigated'
            AND investigated_batch.id = (
              SELECT latest_investigated.id
              FROM deed_registry_import_batches latest_investigated
              WHERE latest_investigated.worksheet_name = 'Investigated'
              ORDER BY latest_investigated.created_at DESC, latest_investigated.id
              LIMIT 1
            )
            AND lower(coalesce(owner_entry.owner_display_name, '')) = lower(coalesce(entry.owner_display_name, ''))
            AND (
              lower(coalesce(owner_entry.owner_display_name, '')) LIKE '%' || search_terms.term || '%'
              OR lower(coalesce(note.raw_remarks, '')) LIKE '%' || search_terms.term || '%'
            )
        )
    )`);
  }

  const limit = normalizeLimit(filters.limit);
  values.push(originalBatch?.id ?? null);
  const originalBatchPlaceholder = `$${values.length}`;
  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  const summaryResult = await pool.query(
    `
      SELECT entry.ownership_scope, entry.parse_confidence, count(*) AS count
      FROM deed_registry_entries entry
      WHERE entry.batch_id = $1
      GROUP BY entry.ownership_scope, entry.parse_confidence
      ORDER BY entry.ownership_scope, entry.parse_confidence
    `,
    [selectedBatchId],
  );

  const entriesResult = await pool.query(
    `
      SELECT
        entry.id::text,
        entry.batch_id::text,
        entry.source_row_number,
        entry.source_row->>'rowType' AS row_type,
        entry.owner_display_name,
        entry.raw_lot_text,
        entry.raw_section_text,
        entry.raw_remarks,
        entry.deed_on_file,
        entry.deed_register_on_file,
        entry.parsed_section_name,
        entry.parsed_section_alias,
        entry.parsed_lot_numbers,
        entry.parsed_plot_numbers,
        entry.parsed_grave_numbers,
        entry.parsed_grave_count,
        entry.ownership_scope,
        entry.parse_confidence,
        entry.parse_notes,
        entry.status,
        count(allocation.id) AS allocation_count,
        COALESCE(investigation.related_notes, '[]'::jsonb) AS related_investigation_notes,
        CASE
          WHEN ${originalBatchPlaceholder}::uuid IS NULL THEN NULL
          WHEN original_match.id IS NULL THEN 'added'
          WHEN COALESCE(original_match.raw_lot_text, '') IS DISTINCT FROM COALESCE(entry.raw_lot_text, '')
            OR COALESCE(original_match.raw_section_text, '') IS DISTINCT FROM COALESCE(entry.raw_section_text, '')
            OR COALESCE(original_match.raw_remarks, '') IS DISTINCT FROM COALESCE(entry.raw_remarks, '')
            OR COALESCE(original_match.deed_on_file, '') IS DISTINCT FROM COALESCE(entry.deed_on_file, '')
            OR COALESCE(original_match.deed_register_on_file, '') IS DISTINCT FROM COALESCE(entry.deed_register_on_file, '')
            OR COALESCE(original_match.parsed_lot_numbers, '{}'::text[]) IS DISTINCT FROM COALESCE(entry.parsed_lot_numbers, '{}'::text[])
            THEN 'changed'
          ELSE 'unchanged'
        END AS comparison_status,
        original_match.source_row_number AS original_source_row_number,
        original_match.raw_lot_text AS original_raw_lot_text,
        original_match.raw_section_text AS original_raw_section_text,
        original_match.raw_remarks AS original_raw_remarks
      FROM deed_registry_entries entry
      LEFT JOIN deed_registry_entry_allocations allocation ON allocation.entry_id = entry.id
      LEFT JOIN LATERAL (
        SELECT original.*
        FROM deed_registry_entries original
        WHERE original.batch_id = ${originalBatchPlaceholder}::uuid
          AND original.source_row->>'rowType' = entry.source_row->>'rowType'
          AND lower(coalesce(original.owner_display_name, '')) = lower(coalesce(entry.owner_display_name, ''))
        ORDER BY
          (COALESCE(original.parsed_lot_numbers, '{}'::text[]) = COALESCE(entry.parsed_lot_numbers, '{}'::text[])) DESC,
          (COALESCE(original.raw_section_text, '') = COALESCE(entry.raw_section_text, '')) DESC,
          original.source_row_number
        LIMIT 1
      ) original_match ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'sourceRowNumber', note.source_row_number,
            'ownerDisplayName', owner_entry.owner_display_name,
            'rawRemarks', note.raw_remarks
          )
          ORDER BY note.source_row_number
        ) AS related_notes
        FROM deed_registry_import_batches investigated_batch
        JOIN deed_registry_entries owner_entry
          ON owner_entry.batch_id = investigated_batch.id
         AND owner_entry.source_row->>'rowType' = 'owner_record'
        JOIN deed_registry_entries note
          ON note.batch_id = investigated_batch.id
         AND note.source_row->>'rowType' = 'investigation_note'
         AND note.source_row_number > owner_entry.source_row_number
         AND NOT EXISTS (
           SELECT 1
           FROM deed_registry_entries next_owner
           WHERE next_owner.batch_id = investigated_batch.id
             AND next_owner.source_row->>'rowType' = 'owner_record'
             AND next_owner.source_row_number > owner_entry.source_row_number
             AND next_owner.source_row_number < note.source_row_number
         )
        WHERE investigated_batch.worksheet_name = 'Investigated'
          AND investigated_batch.id = (
            SELECT latest_investigated.id
            FROM deed_registry_import_batches latest_investigated
            WHERE latest_investigated.worksheet_name = 'Investigated'
            ORDER BY latest_investigated.created_at DESC, latest_investigated.id
            LIMIT 1
          )
          AND lower(coalesce(owner_entry.owner_display_name, '')) = lower(coalesce(entry.owner_display_name, ''))
      ) investigation ON true
      WHERE ${where.join("\n        AND ")}
      GROUP BY
        entry.id,
        investigation.related_notes,
        original_match.id,
        original_match.source_row_number,
        original_match.raw_lot_text,
        original_match.raw_section_text,
        original_match.raw_remarks,
        original_match.deed_on_file,
        original_match.deed_register_on_file,
        original_match.parsed_lot_numbers
      ORDER BY
        CASE entry.parse_confidence
          WHEN 'review' THEN 0
          WHEN 'low' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        entry.source_row_number,
        entry.id
      LIMIT ${limitPlaceholder}
    `,
    values,
  );

  const comparisonResult = originalBatch
    ? await pool.query(
        `
          WITH selected_entries AS (
            SELECT *
            FROM deed_registry_entries
            WHERE batch_id = $1
          ),
          classified AS (
            SELECT
              selected.id,
              CASE
                WHEN original_match.id IS NULL THEN 'added'
                WHEN COALESCE(original_match.raw_lot_text, '') IS DISTINCT FROM COALESCE(selected.raw_lot_text, '')
                  OR COALESCE(original_match.raw_section_text, '') IS DISTINCT FROM COALESCE(selected.raw_section_text, '')
                  OR COALESCE(original_match.raw_remarks, '') IS DISTINCT FROM COALESCE(selected.raw_remarks, '')
                  OR COALESCE(original_match.deed_on_file, '') IS DISTINCT FROM COALESCE(selected.deed_on_file, '')
                  OR COALESCE(original_match.deed_register_on_file, '') IS DISTINCT FROM COALESCE(selected.deed_register_on_file, '')
                  OR COALESCE(original_match.parsed_lot_numbers, '{}'::text[]) IS DISTINCT FROM COALESCE(selected.parsed_lot_numbers, '{}'::text[])
                  THEN 'changed'
                ELSE 'unchanged'
              END AS comparison_status
            FROM selected_entries selected
            LEFT JOIN LATERAL (
              SELECT original.*
              FROM deed_registry_entries original
              WHERE original.batch_id = $2
                AND original.source_row->>'rowType' = selected.source_row->>'rowType'
                AND lower(coalesce(original.owner_display_name, '')) = lower(coalesce(selected.owner_display_name, ''))
              ORDER BY
                (COALESCE(original.parsed_lot_numbers, '{}'::text[]) = COALESCE(selected.parsed_lot_numbers, '{}'::text[])) DESC,
                (COALESCE(original.raw_section_text, '') = COALESCE(selected.raw_section_text, '')) DESC,
                original.source_row_number
              LIMIT 1
            ) original_match ON true
          ),
          removed AS (
            SELECT original.id
            FROM deed_registry_entries original
            WHERE original.batch_id = $2
              AND NOT EXISTS (
                SELECT 1
                FROM selected_entries selected
                WHERE selected.source_row->>'rowType' = original.source_row->>'rowType'
                  AND lower(coalesce(selected.owner_display_name, '')) = lower(coalesce(original.owner_display_name, ''))
              )
          )
          SELECT
            count(*) FILTER (WHERE comparison_status = 'added') AS added_count,
            count(*) FILTER (WHERE comparison_status = 'changed') AS changed_count,
            count(*) FILTER (WHERE comparison_status = 'unchanged') AS unchanged_count,
            (SELECT count(*) FROM removed) AS removed_count
          FROM classified
        `,
        [selectedBatchId, originalBatch.id],
      )
    : { rows: [] };

  const removedResult = originalBatch
    ? await pool.query(
        `
          SELECT
            original.id::text,
            original.source_row_number,
            original.owner_display_name,
            original.raw_lot_text,
            original.raw_section_text,
            original.raw_remarks,
            original.parsed_lot_numbers
          FROM deed_registry_entries original
          WHERE original.batch_id = $1
            AND NOT EXISTS (
              SELECT 1
              FROM deed_registry_entries selected
              WHERE selected.batch_id = $2
                AND selected.source_row->>'rowType' = original.source_row->>'rowType'
                AND lower(coalesce(selected.owner_display_name, '')) = lower(coalesce(original.owner_display_name, ''))
            )
          ORDER BY original.source_row_number
          LIMIT 50
        `,
        [originalBatch.id, selectedBatchId],
      )
    : { rows: [] };

  return {
    batches,
    selectedBatchId,
    summary: summaryResult.rows.map(toSummary),
    comparison: originalBatch ? toComparisonSummary(comparisonResult.rows[0], originalBatch) : null,
    removedOriginalEntries: removedResult.rows.map(toRemovedEntry),
    entries: entriesResult.rows.map(toEntry),
  };
}
