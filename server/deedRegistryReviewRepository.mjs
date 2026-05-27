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
  if (!selectedBatchId) return { batches, selectedBatchId: "", summary: [], entries: [] };

  const where = ["entry.batch_id = $1"];
  const values = [selectedBatchId];
  const confidence = compact(filters.confidence);
  const ownershipScope = compact(filters.ownershipScope);
  const query = compact(filters.q);

  if (confidence && validConfidence.has(confidence)) {
    values.push(confidence);
    where.push(`entry.parse_confidence = $${values.length}`);
  }

  if (ownershipScope && validScopes.has(ownershipScope)) {
    values.push(ownershipScope);
    where.push(`entry.ownership_scope = $${values.length}`);
  }

  if (query) {
    values.push(`%${query.toLowerCase()}%`);
    where.push(`(
      lower(coalesce(entry.owner_display_name, '')) LIKE $${values.length}
      OR lower(coalesce(entry.raw_lot_text, '')) LIKE $${values.length}
      OR lower(coalesce(entry.raw_section_text, '')) LIKE $${values.length}
      OR lower(coalesce(entry.raw_remarks, '')) LIKE $${values.length}
    )`);
  }

  const limit = normalizeLimit(filters.limit);
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
        COALESCE(investigation.related_notes, '[]'::jsonb) AS related_investigation_notes
      FROM deed_registry_entries entry
      LEFT JOIN deed_registry_entry_allocations allocation ON allocation.entry_id = entry.id
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
      GROUP BY entry.id, investigation.related_notes
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

  return {
    batches,
    selectedBatchId,
    summary: summaryResult.rows.map(toSummary),
    entries: entriesResult.rows.map(toEntry),
  };
}
