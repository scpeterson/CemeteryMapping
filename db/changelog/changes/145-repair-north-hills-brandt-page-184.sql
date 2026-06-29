--liquibase formatted sql

--changeset cemeterymapping:145-repair-north-hills-brandt-page-184
UPDATE north_hills_ocr_entries
SET
  source_line_end = 34,
  raw_text = 'BRANDT (3A, 5, s) flat, gray granite, exc cond, flower, leaves "Edward P. Brandt / August 27~ 1877 / Sept. 17, 1963"',
  marker_type_text = 'flat',
  material_text = 'granite',
  condition_text = 'excellent',
  inscription_text = 'Edward P. Brandt / August 27~ 1877 / Sept. 17, 1963',
  parsed_years = ARRAY[1877, 1963]::integer[],
  parse_confidence = 'high',
  parse_notes = ARRAY[]::text[],
  source_entry = jsonb_build_object(
    'heading', 'BRANDT (3A, 5, s) flat, gray granite, exc cond, flower, leaves',
    'descriptor', 'flat, gray granite, exc cond, flower, leaves'
  ),
  updated_at = now()
WHERE source_page_index = 5
  AND source_page_number = 184
  AND source_line_start = 34
  AND name_text = 'BRANDT'
  AND raw_text ILIKE '%Susan Br%ndt%';

DELETE FROM north_hills_ocr_source_facts
WHERE entry_id IN (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 5
    AND source_page_number = 184
    AND source_line_start IN (34, 42, 45)
    AND name_text = 'BRANDT'
)
AND source_code = 'CR';

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
  source.batch_id,
  source.cemetery_id,
  5,
  184,
  37,
  40,
  'BRANDT (3A, 6, s,) upright, gray granite, exc cond "Susan Brandt / - 1867 - [blank)" CR: Note: She is listed in funeral records between June 29 and November 15, 1956, but there is no date of death. "Dr. Myers did not officiate."',
  'BRANDT',
  ARRAY['BRANDT']::text[],
  'A',
  3,
  6,
  'single',
  'upright',
  'granite',
  'excellent',
  'Susan Brandt / - 1867 - [blank)',
  ARRAY[1867, 1956]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object(
    'heading', 'BRANDT (3A, 6, s,) upright, gray granite, exc cond',
    'descriptor', 'upright, gray granite, exc cond'
  )
FROM north_hills_ocr_entries source
WHERE source.source_page_index = 5
  AND source.source_page_number = 184
  AND source.source_line_start = 34
  AND source.name_text = 'BRANDT'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BRANDT (3A, 7, s) upright, gray granite, exc cond "Margaret Brandt / 1871-1939." CR: Middle name Anna, d. October 28, 1939',
  marker_type_text = 'upright',
  material_text = 'granite',
  condition_text = 'excellent',
  inscription_text = 'Margaret Brandt / 1871-1939.',
  parsed_years = ARRAY[1871, 1939]::integer[],
  parse_confidence = 'high',
  parse_notes = ARRAY[]::text[],
  source_entry = jsonb_build_object(
    'heading', 'BRANDT (3A, 7, s) upright, gray granite, exc cond',
    'descriptor', 'upright, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_index = 5
  AND source_page_number = 184
  AND source_line_start = 42
  AND name_text = 'BRANDT';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 45,
  raw_text = 'BRANDT (3A, 8, s) upright, gray granite, exc cond "Sophia Brandt/ 1869-1929" CR: d. March 13, 1929, 60y',
  marker_type_text = 'upright',
  material_text = 'granite',
  condition_text = 'excellent',
  inscription_text = 'Sophia Brandt/ 1869-1929',
  parsed_years = ARRAY[1869, 1929]::integer[],
  parse_confidence = 'high',
  parse_notes = ARRAY[]::text[],
  source_entry = jsonb_build_object(
    'heading', 'BRANDT (3A, 8, s) upright, gray granite, exc cond',
    'descriptor', 'upright, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_index = 5
  AND source_page_number = 184
  AND source_line_start = 45
  AND name_text = 'BRANDT'
  AND raw_text ILIKE '%Walter C%';

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
  source.batch_id,
  source.cemetery_id,
  5,
  184,
  48,
  50,
  'BRANDT (3A, 9, c) upright, gray granite, exc cond, flower, leaf, scrolls "Brandt / Walter C. / 1882-1945 / Mary M. / 1882-1956" CR: Walter, d. March 18, 1945',
  'BRANDT',
  ARRAY['BRANDT']::text[],
  'A',
  3,
  9,
  'couple',
  'upright',
  'granite',
  'excellent',
  'Brandt / Walter C. / 1882-1945 / Mary M. / 1882-1956',
  ARRAY[1882, 1945, 1956]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object(
    'heading', 'BRANDT (3A, 9, c) upright, gray granite, exc cond, flower, leaf, scrolls',
    'descriptor', 'upright, gray granite, exc cond, flower, leaf, scrolls'
  )
FROM north_hills_ocr_entries source
WHERE source.source_page_index = 5
  AND source.source_page_number = 184
  AND source.source_line_start = 45
  AND source.name_text = 'BRANDT'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Note: She is listed in funeral records between June 29 and November 15, 1956, but there is no date of death. "Dr. Myers did not officiate."', NULL::date, 'CR: Note: She is listed in funeral records between June 29 and November 15, 1956, but there is no date of death. "Dr. Myers did not officiate."', 'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 37 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Dr. Myers did not officiate.', NULL::date, 'CR: Note: She is listed in funeral records between June 29 and November 15, 1956, but there is no date of death. "Dr. Myers did not officiate."', 'medium'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 37 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Anna, d. October 28, 1939', NULL::date, 'CR: Middle name Anna, d. October 28, 1939', 'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 42 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'October 28, 1939', DATE '1939-10-28', 'CR: Middle name Anna, d. October 28, 1939', 'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 42 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. March 13, 1929, 60y', NULL::date, 'CR: d. March 13, 1929, 60y', 'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 45 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'March 13, 1929', DATE '1929-03-13', 'CR: d. March 13, 1929, 60y', 'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 45 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '60y', NULL::date, 'CR: d. March 13, 1929, 60y', 'medium'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 45 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Walter, d. March 18, 1945', NULL::date, 'CR: Walter, d. March 18, 1945', 'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 48 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'March 18, 1945', DATE '1945-03-18', 'CR: Walter, d. March 18, 1945', 'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 48 AND name_text = 'BRANDT'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start IN (37, 42, 45, 48) AND name_text = 'BRANDT') AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start IN (37, 48) AND name_text = 'BRANDT';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
