--liquibase formatted sql

--changeset cemeterymapping:134-repair-north-hills-watenpool-page-200 splitStatements:false
WITH candidate_entries AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 21
    AND source_page_number = 200
    AND source_line_start = 3
    AND name_text = 'WATENPOOL'
    AND raw_text LIKE '%DAVIS (JC, 8, s)%'
),
trimmed_watenpool AS (
  UPDATE north_hills_ocr_entries
  SET
    source_line_end = 7,
    raw_text = 'WATENPOOL (3C, 7, c) upright, gray, exc cond, flowers "Watenpool / Peter/ 1859-1939 /Father/ A. Amelia/ 1868-1956 / Mother" On back "Watenpool" CR: Peter, d. September 29, 1939. Anna Amelia, d. January 19, 1956, 87y 7m 27da',
    parsed_years = ARRAY[1859, 1868, 1939, 1956]::integer[],
    inscription_text = 'Watenpool / Peter/ 1859-1939 /Father/ A. Amelia/ 1868-1956 / Mother',
    source_entry = jsonb_build_object(
      'heading', 'WATENPOOL (3C, 7, c) upright, gray, exc cond, flowers',
      'descriptor', 'upright, gray, exc cond, flowers'
    ),
    updated_at = now()
  FROM candidate_entries
  WHERE north_hills_ocr_entries.id = candidate_entries.id
  RETURNING north_hills_ocr_entries.id, north_hills_ocr_entries.batch_id
),
removed_merged_facts AS (
  DELETE FROM north_hills_ocr_source_facts
  USING trimmed_watenpool
  WHERE north_hills_ocr_source_facts.entry_id = trimmed_watenpool.id
    AND north_hills_ocr_source_facts.source_code = 'CR'
  RETURNING north_hills_ocr_source_facts.id
),
inserted_watenpool_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Peter, d. September 29, 1939. Anna Amelia, d. January 19, 1956, 87y 7m 27da', NULL::date, 'CR: Peter, d. September 29, 1939. Anna Amelia, d. January 19, 1956, 87y 7m 27da', 'review'
  FROM trimmed_watenpool
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'September 29, 1939', DATE '1939-09-29', 'CR: Peter, d. September 29, 1939. Anna Amelia, d. January 19, 1956, 87y 7m 27da', 'high'
  FROM trimmed_watenpool
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'January 19, 1956', DATE '1956-01-19', 'CR: Peter, d. September 29, 1939. Anna Amelia, d. January 19, 1956, 87y 7m 27da', 'high'
  FROM trimmed_watenpool
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
  JOIN trimmed_watenpool
    ON trimmed_watenpool.batch_id = candidate_entries.batch_id
  CROSS JOIN (
    VALUES
      (9, 9, 'DAVIS (3C, 8, s) pillow, pink granite, exc cond, flowers, scroll "Pearle H. Davis/ 1901-1988"', 'DAVIS', ARRAY['DAVIS']::text[], 8, 'single', 'pillow', 'pink granite', 'Pearle H. Davis/ 1901-1988', ARRAY[1901, 1988]::integer[], 'DAVIS (JC, 8, s) pillow, pink granite, exc cond, flowers, scroll', 'pillow, pink granite, exc cond, flowers, scroll'),
      (11, 11, 'WILLS (3C, 9, s) upright, gray granite, exc cond "''Aunt Bertie''/ Bertha L. Wills/ 1895-1982" CR: Middle name Louise, d. March 17, 1982, 86y 9m 11da', 'WILLS', ARRAY['WILLS']::text[], 9, 'single', 'upright', 'granite', '''Aunt Bertie''/ Bertha L. Wills/ 1895-1982', ARRAY[1895, 1982]::integer[], 'WILLS (JC, 9, s) upright, gray granite, exc cond', 'upright, gray granite, exc cond'),
      (14, 14, 'WISKEMAN (3C, 10, s) upright, gray granite, exc cond "M. Elva Wiskeman / 1891-1978" CR: First name Marie, d. June 6, 1978, 87y 4m 4da', 'WISKEMAN', ARRAY['WISKEMAN']::text[], 10, 'single', 'upright', 'granite', 'M. Elva Wiskeman / 1891-1978', ARRAY[1891, 1978]::integer[], 'WISKEMAN (JC, 10, s) upright, gray granite, exc cond', 'upright, gray granite, exc cond'),
      (17, 17, 'WISKEMAN/WHISKEMAN (3C, 11, s) upright, gray granite, exc cond "John G. Wiskeman / 1896-1926" Separate flag holder: "American/ US/ Legion", star CR: Whiskeman, d. August 9, 1926', 'WISKEMAN/WHISKEMAN', ARRAY['WISKEMAN','WHISKEMAN']::text[], 11, 'single', 'upright', 'granite', 'John G. Wiskeman / 1896-1926', ARRAY[1896, 1926]::integer[], 'WISKEMAN/WHISKEMAN (JC, 11, s) upright, gray granite, exc cond', 'upright, gray granite, exc cond')
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
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = new_entries.batch_id
      AND existing.source_page_index = 21
      AND existing.source_line_start = new_entries.source_line_start
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id, name_text
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Louise, d. March 17, 1982, 86y 9m 11da', NULL::date, 'CR: Middle name Louise, d. March 17, 1982, 86y 9m 11da', 'review'
FROM inserted_entries
WHERE name_text = 'WILLS'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'March 17, 1982', DATE '1982-03-17', 'CR: Middle name Louise, d. March 17, 1982, 86y 9m 11da', 'high'
FROM inserted_entries
WHERE name_text = 'WILLS'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'First name Marie, d. June 6, 1978, 87y 4m 4da', NULL::date, 'CR: First name Marie, d. June 6, 1978, 87y 4m 4da', 'review'
FROM inserted_entries
WHERE name_text = 'WISKEMAN'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'June 6, 1978', DATE '1978-06-06', 'CR: First name Marie, d. June 6, 1978, 87y 4m 4da', 'high'
FROM inserted_entries
WHERE name_text = 'WISKEMAN'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Whiskeman, d. August 9, 1926', NULL::date, 'CR: Whiskeman, d. August 9, 1926', 'review'
FROM inserted_entries
WHERE name_text = 'WISKEMAN/WHISKEMAN'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 9, 1926', DATE '1926-08-09', 'CR: Whiskeman, d. August 9, 1926', 'high'
FROM inserted_entries
WHERE name_text = 'WISKEMAN/WHISKEMAN'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 21 AND source_page_number = 200 AND source_line_start IN (3, 9, 11, 14, 17) AND name_text IN ('WATENPOOL', 'DAVIS', 'WILLS', 'WISKEMAN', 'WISKEMAN/WHISKEMAN')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 21 AND source_page_number = 200 AND source_line_start IN (9, 11, 14, 17) AND name_text IN ('DAVIS', 'WILLS', 'WISKEMAN', 'WISKEMAN/WHISKEMAN');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
