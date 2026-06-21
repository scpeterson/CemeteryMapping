--liquibase formatted sql

--changeset cemeterymapping:127-repair-north-hills-hamilton-page-199
WITH candidate_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 20
    AND source_page_number = 199
    AND source_line_start = 34
    AND name_text = 'WILL'
    AND raw_text LIKE '%HAMILTON/WOODRUFF%'
),
trimmed_ida_will AS (
  UPDATE north_hills_ocr_entries
  SET
    source_line_end = 35,
    raw_text = 'WILL (3C, 3, s) upright, gray granite, exc cond, tiny flowers "Ida V. Will/ 1884-1930 / Mother"',
    inscription_text = 'Ida V. Will/ 1884-1930 / Mother',
    parsed_years = ARRAY[1884, 1930]::integer[],
    source_entry = jsonb_build_object(
      'heading', 'WILL (3C, 3, s) upright, gray granite, exc cond, tiny flowers "Ida V.',
      'descriptor', 'upright, gray granite, exc cond, tiny flowers'
    ),
    updated_at = now()
  FROM candidate_batches
  WHERE north_hills_ocr_entries.batch_id = candidate_batches.batch_id
    AND north_hills_ocr_entries.source_page_index = 20
    AND north_hills_ocr_entries.source_page_number = 199
    AND north_hills_ocr_entries.source_line_start = 34
    AND north_hills_ocr_entries.name_text = 'WILL'
    AND north_hills_ocr_entries.raw_text LIKE '%HAMILTON/WOODRUFF%'
  RETURNING north_hills_ocr_entries.batch_id
),
inserted_hamilton AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id,
    cemetery_id,
    source_page_index,
    source_page_number,
    source_line_start,
    source_line_end,
    raw_text,
    name_text,
    surnames,
    parsed_section_name,
    parsed_row_number,
    parsed_position_number,
    parsed_marker_scope,
    marker_type_text,
    material_text,
    condition_text,
    inscription_text,
    parsed_years,
    parse_confidence,
    parse_notes,
    source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    20,
    199,
    37,
    39,
    'HAMILTON/WOODRUFF (3C, 4, s) upright, gray granite, exc cond, flowers, cross "George W. Hamilton/ 1885-1944" CR: Middle name Woodruff, d. August 29, 1944',
    'HAMILTON/WOODRUFF',
    ARRAY['HAMILTON', 'WOODRUFF']::text[],
    'C',
    3,
    4,
    'single',
    'upright',
    'granite',
    'excellent',
    'George W. Hamilton/ 1885-1944',
    ARRAY[1885, 1944]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object(
      'heading', 'HAMILTON/WOODRUFF (JC, 4, s) upright, gray granite, exc cond,',
      'descriptor', 'upright, gray granite, exc cond, flowers, cross'
    )
  FROM candidate_batches
  WHERE EXISTS (
    SELECT 1
    FROM trimmed_ida_will
    WHERE trimmed_ida_will.batch_id = candidate_batches.batch_id
  )
    AND NOT EXISTS (
      SELECT 1
      FROM north_hills_ocr_entries existing
      WHERE existing.batch_id = candidate_batches.batch_id
        AND existing.source_page_number = 199
        AND existing.parsed_section_name = 'C'
        AND existing.parsed_row_number = 3
        AND existing.parsed_position_number = 4
    )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Woodruff, d. August 29, 1944', NULL::date, 'CR: Middle name Woodruff, d. August 29, 1944', 'review'
FROM inserted_hamilton
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 29, 1944', DATE '1944-08-29', 'CR: Middle name Woodruff, d. August 29, 1944', 'high'
FROM inserted_hamilton
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE name_text = 'HAMILTON/WOODRUFF' AND source_page_index = 20 AND source_page_number = 199 AND source_line_start = 37);
--rollback DELETE FROM north_hills_ocr_entries WHERE name_text = 'HAMILTON/WOODRUFF' AND source_page_index = 20 AND source_page_number = 199 AND source_line_start = 37;
