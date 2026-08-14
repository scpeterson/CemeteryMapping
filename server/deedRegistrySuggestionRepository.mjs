function clean(value) {
  return String(value ?? "").trim();
}

function yes(value) {
  return clean(value).toLowerCase() === "yes";
}

function suggestion(row) {
  const references = [];
  if (row.original_row_number) references.push(`Original 2017 tab - line ${row.original_row_number}`);
  if (row.updated_row_number) references.push(`Updated 2022 tab - line ${row.updated_row_number}`);
  const originalRemarks = clean(row.original_remarks);
  const updatedRemarks = clean(row.updated_remarks);
  if (originalRemarks && updatedRemarks && originalRemarks !== updatedRemarks) {
    references.push(`Original 2017 remarks: ${originalRemarks}`);
    references.push(`Updated 2022 remarks: ${updatedRemarks}`);
  } else if (updatedRemarks || originalRemarks) {
    references.push(`Remarks: ${updatedRemarks || originalRemarks}`);
  }
  return {
    id: row.updated_id ?? row.original_id,
    ownerDisplayName: clean(row.updated_owner_name || row.original_owner_name),
    address: clean(row.updated_address || row.original_address),
    city: clean(row.updated_city || row.original_city),
    state: clean(row.updated_state || row.original_state),
    effectiveDate: clean(row.updated_known_date || row.original_known_date),
    deedOnFile: yes(row.updated_deed_on_file),
    deedRegisterOnFile: yes(row.updated_deed_register_on_file),
    modernSection: clean(row.updated_modern_section || row.original_modern_section),
    lotText: clean(row.updated_lot_text || row.original_lot_text),
    documentReference: "Trinity Cemetery Registry 2022",
    notes: references.join("\n"),
    originalRowNumber: row.original_row_number ?? undefined,
    updatedRowNumber: row.updated_row_number ?? undefined,
  };
}

export async function findDeedRegistrySuggestions(pool, cemeteryId, query) {
  const terms = [...new Set(clean(query).toLowerCase().split(/[^a-z0-9]+/u).filter((term) => term.length >= 2))].slice(0, 8);
  if (terms.length === 0) return [];
  const result = await pool.query(
    `
      WITH latest_batches AS (
        SELECT DISTINCT ON (worksheet_name) id, worksheet_name
        FROM deed_registry_import_batches
        WHERE cemetery_id = $1
          AND worksheet_name IN ('Original 2017', 'Updated 2022')
        ORDER BY worksheet_name, created_at DESC, id DESC
      ),
      updated AS (
        SELECT entry.*
        FROM deed_registry_entries entry
        JOIN latest_batches batch ON batch.id = entry.batch_id AND batch.worksheet_name = 'Updated 2022'
        WHERE entry.source_row->>'rowType' = 'owner_record'
          AND ${terms.map((_, index) => `lower(entry.owner_display_name) LIKE $${index + 2}`).join(" AND ")}
      )
      SELECT
        updated.id::text AS updated_id,
        updated.source_row_number AS updated_row_number,
        updated.owner_display_name AS updated_owner_name,
        updated.address AS updated_address,
        updated.city AS updated_city,
        updated.state AS updated_state,
        COALESCE(updated.corrected_last_known_date, updated.last_known_date) AS updated_known_date,
        updated.deed_on_file AS updated_deed_on_file,
        updated.deed_register_on_file AS updated_deed_register_on_file,
        updated.raw_remarks AS updated_remarks,
        updated.modern_section AS updated_modern_section,
        COALESCE(updated.corrected_lot_text, updated.raw_lot_text) AS updated_lot_text,
        original.id::text AS original_id,
        original.source_row_number AS original_row_number,
        original.owner_display_name AS original_owner_name,
        original.address AS original_address,
        original.city AS original_city,
        original.state AS original_state,
        COALESCE(original.corrected_last_known_date, original.last_known_date) AS original_known_date,
        original.raw_remarks AS original_remarks,
        original.modern_section AS original_modern_section,
        COALESCE(original.corrected_lot_text, original.raw_lot_text) AS original_lot_text
      FROM updated
      LEFT JOIN LATERAL (
        SELECT entry.*
        FROM deed_registry_entries entry
        JOIN latest_batches batch ON batch.id = entry.batch_id AND batch.worksheet_name = 'Original 2017'
        WHERE entry.source_row->>'rowType' = 'owner_record'
          AND lower(entry.owner_display_name) = lower(updated.owner_display_name)
        ORDER BY
          (COALESCE(entry.parsed_lot_numbers, '{}'::text[]) = COALESCE(updated.parsed_lot_numbers, '{}'::text[])) DESC,
          entry.source_row_number
        LIMIT 1
      ) original ON true
      ORDER BY updated.owner_display_name, updated.source_row_number
      LIMIT 12
    `,
    [cemeteryId, ...terms.map((term) => `%${term}%`)],
  );
  return result.rows.map(suggestion);
}
