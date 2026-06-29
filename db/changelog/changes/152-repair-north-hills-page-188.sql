--liquibase formatted sql

--changeset cemeterymapping:152-repair-north-hills-page-188
UPDATE north_hills_ocr_entries
SET
  source_line_end = 14,
  raw_text = 'CARMEN/WICK (7A, 9, s) upright, black granite, exc cond, 3 hearts "Sally Ann Carmen/ December 29, 1959 - August 11, 1996 / child of God, Wife, and Mother" On back: "Sally Ann Carmen/ The Lord is my shepherd I shall not want ... / Surety goodness and mercy shall follow / me all the days of my life, and I will dwell / in the house of the Lord forever" CR: Sally Wick Carmen',
  inscription_text = 'Sally Ann Carmen/ December 29, 1959 - August 11, 1996 / child of God, Wife, and Mother Sally Ann Carmen/ The Lord is my shepherd I shall not want ... / Surety goodness and mercy shall follow / me all the days of my life, and I will dwell / in the house of the Lord forever',
  parsed_years = ARRAY[1959, 1996]::integer[],
  source_entry = jsonb_build_object('heading', 'CARMEN/WICK (7A, 9, s) upright, black granite, exc cond, 3 hearts', 'descriptor', 'upright, black granite, exc cond, 3 hearts'),
  updated_at = now()
WHERE source_page_number = 188
  AND source_line_start = 9
  AND name_text = 'CARMEN/WICK';

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
  source.source_page_index,
  188,
  17,
  18,
  'PEARCE/HOLMAN {7A, 10, s) pillow, pink granite, exc cond, open book, ivy "Elizabeth Holman / Pearce/ April 4, 1923 / July 30, 1993" CR: Elizabeth''s middle name, Jane',
  'PEARCE/HOLMAN',
  ARRAY['PEARCE', 'HOLMAN']::text[],
  'A',
  7,
  10,
  'single',
  'pillow',
  'granite',
  'excellent',
  'Elizabeth Holman / Pearce/ April 4, 1923 / July 30, 1993',
  ARRAY[1923, 1993]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'PEARCE/HOLMAN {7A, 10, s) pillow, pink granite, exc cond, open book, ivy', 'descriptor', 'pillow, pink granite, exc cond, open book, ivy')
FROM north_hills_ocr_entries source
WHERE source.source_page_number = 188
  AND source.source_line_start = 9
  AND source.name_text = 'CARMEN/WICK'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = 'STEELE (8A, 2, c) pillow, gray granite, exc cond, cross, flowers "Steele/ Father/ George H. / 1903-1991 /Mother / Bertie I./ 1907 [blank]" CR: George, May 4, 1903 - Aug, 5. 1991. Bertie, July 8, 1907 - December 13, 2005',
  inscription_text = 'Steele/ Father/ George H. / 1903-1991 /Mother / Bertie I./ 1907 [blank]',
  source_entry = jsonb_build_object('heading', 'STEELE (8A, 2, c) pillow, gray granite, exc cond, cross, flowers', 'descriptor', 'pillow, gray granite, exc cond, cross, flowers'),
  updated_at = now()
WHERE source_page_number = 188
  AND source_line_start = 34
  AND name_text = 'STEELE';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 40,
  raw_text = 'STEELE (8A, 3, s) pillow, gray granite, exc cond, flowers "Infant son of I George & Bertie Steele/ Aug: 11, 1939"',
  name_text = 'STEELE',
  surnames = ARRAY['STEELE']::text[],
  parsed_section_name = 'A',
  parsed_row_number = 8,
  parsed_position_number = 3,
  parsed_marker_scope = 'single',
  marker_type_text = 'pillow',
  material_text = 'granite',
  condition_text = 'excellent',
  inscription_text = 'Infant son of I George & Bertie Steele/ Aug: 11, 1939',
  parsed_years = ARRAY[1939]::integer[],
  parse_confidence = 'high',
  parse_notes = ARRAY[]::text[],
  source_entry = jsonb_build_object('heading', 'STEELE (8A, 3, s) pillow, gray granite, exc cond, flowers', 'descriptor', 'pillow, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_number = 188
  AND source_line_start = 39
  AND name_text = 'STEELE';

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
  source.source_page_index,
  188,
  42,
  45,
  'BLEND (8A, 4, c) upright, gray granite, exc cond, flowers "Blend / Henry L. / 1873-1944 / Father / Bertha M. / 1877-1956 / Mother" On back: "Blend" Iron (rusty) marker: "Brother/ John A. Irwin Fire Co. / Organized / 1896"',
  'BLEND',
  ARRAY['BLEND']::text[],
  'A',
  8,
  4,
  'couple',
  'upright',
  'granite',
  'excellent',
  'Blend / Henry L. / 1873-1944 / Father / Bertha M. / 1877-1956 / Mother Blend Brother/ John A. Irwin Fire Co. / Organized / 1896',
  ARRAY[1873, 1877, 1896, 1944, 1956]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'BLEND (8A, 4, c) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers')
FROM north_hills_ocr_entries source
WHERE source.source_page_number = 188
  AND source.source_line_start = 39
  AND source.name_text = 'STEELE'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

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
  source.source_page_index,
  188,
  47,
  50,
  'BRADY/MILFORD (8A, 5, c) upright, gray granite, exc cond, flowers, cross "Brady / Charles M. / Nov. 5, 1912 / Jan.30, 1976 / Marion M. / Oct, 12, 1913 / Feb. 7, 1999" On back: "Brady" CR: Middle name Milford',
  'BRADY/MILFORD',
  ARRAY['BRADY', 'MILFORD']::text[],
  'A',
  8,
  5,
  'couple',
  'upright',
  'granite',
  'excellent',
  'Brady / Charles M. / Nov. 5, 1912 / Jan.30, 1976 / Marion M. / Oct, 12, 1913 / Feb. 7, 1999 Brady',
  ARRAY[1912, 1913, 1976, 1999]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'BRADY/MILFORD (8A, 5, c) upright, gray granite, exc cond, flowers, cross', 'descriptor', 'upright, gray granite, exc cond, flowers, cross')
FROM north_hills_ocr_entries source
WHERE source.source_page_number = 188
  AND source.source_line_start = 39
  AND source.name_text = 'STEELE'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BRADY/MILFORD (8A, 5, c) upright, gray granite, exc cond, flowers, cross "Brady / Charles M. / Nov. 5, 1912 / Jan.30, 1976 / Marion M. / Oct, 12, 1913 / Feb. 7, 1999" On back: "Brady" CR: Middle name Milford',
  parsed_section_name = 'A',
  parsed_row_number = 8,
  parsed_position_number = 5,
  parsed_marker_scope = 'couple',
  inscription_text = 'Brady / Charles M. / Nov. 5, 1912 / Jan.30, 1976 / Marion M. / Oct, 12, 1913 / Feb. 7, 1999 Brady',
  parsed_years = ARRAY[1912, 1913, 1976, 1999]::integer[],
  source_entry = jsonb_build_object('heading', 'BRADY/MILFORD (8A, 5, c) upright, gray granite, exc cond, flowers, cross', 'descriptor', 'upright, gray granite, exc cond, flowers, cross'),
  updated_at = now()
WHERE source_page_number = 188
  AND source_line_start = 47
  AND name_text = 'BRADY/MILFORD';

DELETE FROM north_hills_ocr_source_facts
WHERE entry_id IN (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 188
    AND source_line_start IN (9, 17, 34, 39, 42, 47)
    AND name_text IN ('CARMEN/WICK', 'PEARCE/HOLMAN', 'STEELE', 'BLEND', 'BRADY/MILFORD')
)
AND source_code = 'CR';

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Sally Wick Carmen', NULL::date, 'CR: Sally Wick Carmen', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start = 9 AND name_text = 'CARMEN/WICK'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Elizabeth''s middle name, Jane', NULL::date, 'CR: Elizabeth''s middle name, Jane', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start = 17 AND name_text = 'PEARCE/HOLMAN'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'George, May 4, 1903 - Aug, 5. 1991. Bertie, July 8, 1907 - December 13, 2005', NULL::date, 'CR: George, May 4, 1903 - Aug, 5. 1991. Bertie, July 8, 1907 - December 13, 2005', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start = 34 AND name_text = 'STEELE'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Milford', NULL::date, 'CR: Middle name Milford', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start = 47 AND name_text = 'BRADY/MILFORD'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start IN (9, 17, 34, 39, 42, 47) AND name_text IN ('CARMEN/WICK', 'PEARCE/HOLMAN', 'STEELE', 'BLEND', 'BRADY/MILFORD')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start IN (17, 42) AND name_text IN ('PEARCE/HOLMAN', 'BLEND');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start = 47 AND name_text = 'BRADY/MILFORD' AND batch_id IN (SELECT batch_id FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_line_start = 39 AND source_line_end = 40 AND name_text = 'STEELE');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
