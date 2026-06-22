--liquibase formatted sql

--changeset cemeterymapping:137-repair-north-hills-wills-page-200 splitStatements:false
WITH candidate_entries AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 21
    AND source_page_number = 200
    AND source_line_start = 23
    AND name_text = 'WILLS'
    AND raw_text LIKE '%WILLS/BROERMAN/WILL (JC, 14, c)%'
),
trimmed_wills AS (
  UPDATE north_hills_ocr_entries
  SET
    source_line_end = 26,
    raw_text = 'WILLS (3C, 12, s) pillow, gray granite, exc cond, grapes, leaves, church window "John H. Wills/ 1875-1956 / Brother" CR: Middle name Henry, d. June 29, 1956, Sly 4m 17da',
    parsed_years = ARRAY[1875, 1956]::integer[],
    inscription_text = 'John H. Wills/ 1875-1956 / Brother',
    source_entry = jsonb_build_object(
      'heading', 'WILLS (3C, 12, s) pillow, gray granite, exc cond, grapes, leaves, church window',
      'descriptor', 'pillow, gray granite, exc cond, grapes, leaves, church window'
    ),
    updated_at = now()
  FROM candidate_entries
  WHERE north_hills_ocr_entries.id = candidate_entries.id
  RETURNING north_hills_ocr_entries.id, north_hills_ocr_entries.batch_id
),
removed_merged_facts AS (
  DELETE FROM north_hills_ocr_source_facts
  USING trimmed_wills
  WHERE north_hills_ocr_source_facts.entry_id = trimmed_wills.id
    AND north_hills_ocr_source_facts.source_code = 'CR'
  RETURNING north_hills_ocr_source_facts.id
),
inserted_wills_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Middle name Henry, d. June 29, 1956, Sly 4m 17da', NULL::date, 'CR: Middle name Henry, d. June 29, 1956, Sly 4m 17da', 'review'
  FROM trimmed_wills
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'June 29, 1956', DATE '1956-06-29', 'CR: Middle name Henry, d. June 29, 1956, Sly 4m 17da', 'high'
  FROM trimmed_wills
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
  RETURNING id
),
new_entries(batch_id, cemetery_id, source_line_start, source_line_end, raw_text, name_text, surnames, parsed_position_number, marker_scope, marker_type, material, inscription_text, parsed_years, source_heading, source_descriptor) AS (
  SELECT
    candidate_entries.batch_id,
    candidate_entries.cemetery_id,
    reading.source_line_start,
    reading.source_line_end,
    reading.raw_text,
    reading.name_text,
    reading.surnames,
    reading.parsed_position_number,
    reading.marker_scope,
    reading.marker_type,
    reading.material,
    reading.inscription_text,
    reading.parsed_years,
    reading.source_heading,
    reading.source_descriptor
  FROM candidate_entries
  JOIN trimmed_wills
    ON trimmed_wills.batch_id = candidate_entries.batch_id
  CROSS JOIN (
    VALUES
      (27, 30, 'WILLS (3C, 13, s) pillow, gray granite, exc cond, grapes, leaves, church window "Frank E. Wills/ 1880-1927 / Brother" CR: d. December 18, 1927', 'WILLS', ARRAY['WILLS']::text[], 13, 'single', 'pillow', 'granite', 'Frank E. Wills/ 1880-1927 / Brother', ARRAY[1880, 1927]::integer[], 'WILLS (3C, 13, s) pillow, gray granite, exc cond, grapes, leaves, church window', 'pillow, gray granite, exc cond, grapes, leaves, church window'),
      (31, 35, 'WILLS/BROERMAN/WILL (3C, 14, c) upright, gray granite, exc cond, ornate scrollwork at top with "W" "WIiis / Frank Wills/ 1843-1926 / Elizabeth Wills/ 1849-1920" Separate flag holder: "GAR/ 1861 / 1865" CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', 'WILLS/BROERMAN/WILL', ARRAY['WILLS','BROERMAN','WILL']::text[], 14, 'couple', 'upright', 'granite', 'W WIiis / Frank Wills/ 1843-1926 / Elizabeth Wills/ 1849-1920 GAR/ 1861 / 1865', ARRAY[1843, 1849, 1861, 1865, 1920, 1926]::integer[], 'WILLS/BROERMAN/WILL (3C, 14, c) upright, gray granite, exc cond, ornate scrollwork at top with "W"', 'upright, gray granite, exc cond, ornate scrollwork at top with "W"')
  ) AS reading(source_line_start, source_line_end, raw_text, name_text, surnames, parsed_position_number, marker_scope, marker_type, material, inscription_text, parsed_years, source_heading, source_descriptor)
),
inserted_entries AS (
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
    21,
    200,
    source_line_start,
    source_line_end,
    raw_text,
    name_text,
    surnames,
    'C',
    3,
    parsed_position_number,
    marker_scope,
    marker_type,
    material,
    'excellent',
    inscription_text,
    parsed_years,
    'high',
    ARRAY[]::text[],
    jsonb_build_object(
      'heading', source_heading,
      'descriptor', source_descriptor
    )
  FROM new_entries
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id, name_text, source_line_start
),
page_entries AS (
  SELECT id, name_text, source_line_start
  FROM north_hills_ocr_entries
  WHERE source_page_index = 21
    AND source_page_number = 200
    AND source_line_start IN (23, 27, 31)
    AND name_text IN ('WILLS', 'WILLS/BROERMAN/WILL')
    AND batch_id IN (SELECT batch_id FROM candidate_entries)
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. December 18, 1927', NULL::date, 'CR: d. December 18, 1927', 'review'
FROM page_entries
WHERE source_line_start = 27
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'December 18, 1927', DATE '1927-12-18', 'CR: d. December 18, 1927', 'high'
FROM page_entries
WHERE source_line_start = 27
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', NULL::date, 'CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', 'review'
FROM page_entries
WHERE source_line_start = 31
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 28, 1926', DATE '1926-05-28', 'CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', 'high'
FROM page_entries
WHERE source_line_start = 31
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'April 19, 1920', DATE '1920-04-19', 'CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', 'high'
FROM page_entries
WHERE source_line_start = 31
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 21 AND source_page_number = 200 AND source_line_start IN (23, 27, 31) AND name_text IN ('WILLS', 'WILLS/BROERMAN/WILL')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 21 AND source_page_number = 200 AND source_line_start IN (27, 31) AND name_text IN ('WILLS', 'WILLS/BROERMAN/WILL');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
