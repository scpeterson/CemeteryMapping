--liquibase formatted sql

--changeset cemeterymapping:155-repair-north-hills-page-190
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  source.source_page_index,
  190,
  5,
  8,
  'WOOMER (10A, 3, s) pillow, gray granite, exc cond "Walter Joseph Woomer/ Fireman 1/C U. S. Navy/ enlisted June 9, 1917 / discharged / July 14, 1919 / born April 8, 1897 / died Feb. 21, 1962" Separate flag holder: "American/ US/ Legion", star',
  'WOOMER',
  ARRAY['WOOMER']::text[],
  'A',
  10,
  3,
  'single',
  'pillow',
  'granite',
  'excellent',
  'Walter Joseph Woomer/ Fireman 1/C U. S. Navy/ enlisted June 9, 1917 / discharged / July 14, 1919 / born April 8, 1897 / died Feb. 21, 1962 American/ US/ Legion',
  ARRAY[1897, 1917, 1919, 1962]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'WOOMER (10A, 3, s) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond')
FROM (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 190
) source
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  source.source_page_index,
  190,
  10,
  11,
  'WOOMER (10A, 4, s) pillow, gray granite, exc cond "Mary C. Woomer / wife of / Walter J. Woomer/ April 8, 1899 / April 10, 1974"',
  'WOOMER',
  ARRAY['WOOMER']::text[],
  'A',
  10,
  4,
  'single',
  'pillow',
  'granite',
  'excellent',
  'Mary C. Woomer / wife of / Walter J. Woomer/ April 8, 1899 / April 10, 1974',
  ARRAY[1899, 1974]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'WOOMER (10A, 4, s) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond')
FROM (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 190
) source
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 11,
  raw_text = 'WOOMER (10A, 4, s) pillow, gray granite, exc cond "Mary C. Woomer / wife of / Walter J. Woomer/ April 8, 1899 / April 10, 1974"',
  inscription_text = 'Mary C. Woomer / wife of / Walter J. Woomer/ April 8, 1899 / April 10, 1974',
  parsed_years = ARRAY[1899, 1974]::integer[],
  source_entry = jsonb_build_object('heading', 'WOOMER (10A, 4, s) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_number = 190
  AND source_line_start = 10
  AND name_text = 'WOOMER';

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  source.source_page_index,
  190,
  13,
  14,
  'DePRIEST (10A, 5, s) pillow, gray granite, exc cond, photo "Linda DePriest / June 6, 1951 / March 17, 1994"',
  'DePRIEST',
  ARRAY['DePRIEST']::text[],
  'A',
  10,
  5,
  'single',
  'pillow',
  'granite',
  'excellent',
  'Linda DePriest / June 6, 1951 / March 17, 1994',
  ARRAY[1951, 1994]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'DePRIEST (10A, 5, s) pillow, gray granite, exc cond, photo', 'descriptor', 'pillow, gray granite, exc cond, photo')
FROM (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 190
) source
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = 'RINGEISEN (10A, 6, c) upright, gray granite, exc cond, flowers "Ringeisen/ Andrew C. / 1871-1946 / Father / Lena C. / 1872-1954 / Mother / Asleep in Jesus'''' CR: Andrew Ringeisen, d. July 17, 1946, 75y 3m 18da. Mrs. Lena, d. August 20, 1954, Sly 9m 18da',
  inscription_text = 'Ringeisen/ Andrew C. / 1871-1946 / Father / Lena C. / 1872-1954 / Mother / Asleep in Jesus''',
  source_entry = jsonb_build_object('heading', 'RINGEISEN (10A, 6, c) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_number = 190
  AND source_line_start = 18
  AND name_text = 'RINGEISEN';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'RINGEISEN (10A, 8, s) upright, gray granite, exc cond, flowers "Frank A. Ringeisen / July 6, 1904 / June 5, 1973 / Husband"',
  inscription_text = 'Frank A. Ringeisen / July 6, 1904 / June 5, 1973 / Husband',
  source_entry = jsonb_build_object('heading', 'RINGEISEN (10A, 8, s) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_number = 190
  AND source_line_start = 26
  AND name_text = 'RINGEISEN';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'RICE (10A, 9, s) upright, gray granite, exc cond, flowers "Ida Rice/ wife of / John Rice / 1867-1928" CR: Middle name Maria, d. April 28, 1928',
  inscription_text = 'Ida Rice/ wife of / John Rice / 1867-1928',
  source_entry = jsonb_build_object('heading', 'RICE (10A, 9, s) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_number = 190
  AND source_line_start = 29
  AND name_text = 'RICE';

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  source.source_page_index,
  190,
  34,
  36,
  'McCLINTOCK (1B, 1, s) upright, gray granite, exc cond, palm leaves "James S. / McClintock / 1854-1909 / Gone but not forgotten" CR: d. November 22, 1909',
  'McCLINTOCK',
  ARRAY['McCLINTOCK']::text[],
  'B',
  1,
  1,
  'single',
  'upright',
  'granite',
  'excellent',
  'James S. / McClintock / 1854-1909 / Gone but not forgotten',
  ARRAY[1854, 1909]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'McCLINTOCK (1B, 1, s) upright, gray granite, exc cond, palm leaves', 'descriptor', 'upright, gray granite, exc cond, palm leaves')
FROM (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 190
) source
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 40,
  raw_text = 'MCCLINTOCK (1B, 2, s) upright, small white marble, good cond "Catherine D. / McClintock / 1864-1951" CR: Middle Initial E., d. March 9, 1951, 86y 11m 6da',
  inscription_text = 'Catherine D. / McClintock / 1864-1951',
  parsed_years = ARRAY[1864, 1951]::integer[],
  source_entry = jsonb_build_object('heading', 'MCCLINTOCK (1B, 2, s) upright, small white marble, good cond', 'descriptor', 'upright, small white marble, good cond'),
  updated_at = now()
WHERE source_page_number = 190
  AND source_line_start = 38
  AND name_text = 'MCCLINTOCK';

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  source.source_page_index,
  190,
  42,
  44,
  'McCARRIER/DEER (1B, 3, s) upright, small white marble, good cond, some discoloration "Elizabeth D. / McCarrier / 1860-1951" CR: Mrs. Elizabeth Deer McCarrier, d. June 11, 1951, 90y 10m 7da',
  'McCARRIER/DEER',
  ARRAY['McCARRIER', 'DEER']::text[],
  'B',
  1,
  3,
  'single',
  'upright',
  'marble',
  'good',
  'Elizabeth D. / McCarrier / 1860-1951',
  ARRAY[1860, 1951]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'McCARRIER/DEER (1B, 3, s) upright, small white marble, good cond, some discoloration', 'descriptor', 'upright, small white marble, good cond, some discoloration')
FROM north_hills_ocr_entries source
WHERE source.source_page_number = 190
  AND source.source_line_start = 38
  AND source.name_text = 'MCCLINTOCK'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  source.source_page_index,
  190,
  48,
  49,
  'DEER (1B, 4, s) small upright, white marble, good cond "Nannie" See Deer family obelisk (2B, 5)',
  'DEER',
  ARRAY['DEER']::text[],
  'B',
  1,
  4,
  'single',
  'upright',
  'marble',
  'good',
  'Nannie',
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', 'DEER (1B, 4, s) small upright, white marble, good cond', 'descriptor', 'small upright, white marble, good cond')
FROM (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 190
) source
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 49,
  raw_text = 'DEER (1B, 4, s) small upright, white marble, good cond "Nannie" See Deer family obelisk (2B, 5)',
  inscription_text = 'Nannie',
  source_entry = jsonb_build_object('heading', 'DEER (1B, 4, s) small upright, white marble, good cond', 'descriptor', 'small upright, white marble, good cond'),
  updated_at = now()
WHERE source_page_number = 190
  AND source_line_start = 48
  AND name_text = 'DEER';

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  source.source_page_index,
  190,
  50,
  51,
  'DEER (1B, 5, s) small upright, white marble, good cond "Myrtle" See Deer family obelisk, (2B, 5)',
  'DEER',
  ARRAY['DEER']::text[],
  'B',
  1,
  5,
  'single',
  'upright',
  'marble',
  'good',
  'Myrtle',
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', 'DEER (1B, 5, s) small upright, white marble, good cond', 'descriptor', 'small upright, white marble, good cond')
FROM (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 190
) source
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

DELETE FROM north_hills_ocr_source_facts
WHERE entry_id IN (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 190
    AND source_line_start IN (18, 29, 34, 38, 42)
    AND name_text IN ('RINGEISEN', 'RICE', 'McCLINTOCK', 'MCCLINTOCK', 'McCARRIER/DEER')
)
AND source_code = 'CR';

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Andrew Ringeisen, d. July 17, 1946, 75y 3m 18da. Mrs. Lena, d. August 20, 1954, Sly 9m 18da', NULL::date, 'CR: Andrew Ringeisen, d. July 17, 1946, 75y 3m 18da. Mrs. Lena, d. August 20, 1954, Sly 9m 18da', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 18 AND name_text = 'RINGEISEN'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'July 17, 1946', DATE '1946-07-17', 'CR: Andrew Ringeisen, d. July 17, 1946, 75y 3m 18da. Mrs. Lena, d. August 20, 1954, Sly 9m 18da', 'high'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 18 AND name_text = 'RINGEISEN'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 20, 1954', DATE '1954-08-20', 'CR: Andrew Ringeisen, d. July 17, 1946, 75y 3m 18da. Mrs. Lena, d. August 20, 1954, Sly 9m 18da', 'high'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 18 AND name_text = 'RINGEISEN'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Maria, d. April 28, 1928', NULL::date, 'CR: Middle name Maria, d. April 28, 1928', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 29 AND name_text = 'RICE'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'April 28, 1928', DATE '1928-04-28', 'CR: Middle name Maria, d. April 28, 1928', 'high'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 29 AND name_text = 'RICE'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. November 22, 1909', NULL::date, 'CR: d. November 22, 1909', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 34 AND name_text = 'McCLINTOCK'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'November 22, 1909', DATE '1909-11-22', 'CR: d. November 22, 1909', 'high'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 34 AND name_text = 'McCLINTOCK'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Middle Initial E., d. March 9, 1951, 86y 11m 6da', NULL::date, 'CR: Middle Initial E., d. March 9, 1951, 86y 11m 6da', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 38 AND name_text = 'MCCLINTOCK'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'March 9, 1951', DATE '1951-03-09', 'CR: Middle Initial E., d. March 9, 1951, 86y 11m 6da', 'high'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 38 AND name_text = 'MCCLINTOCK'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Mrs. Elizabeth Deer McCarrier, d. June 11, 1951, 90y 10m 7da', NULL::date, 'CR: Mrs. Elizabeth Deer McCarrier, d. June 11, 1951, 90y 10m 7da', 'review'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 42 AND name_text = 'McCARRIER/DEER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'June 11, 1951', DATE '1951-06-11', 'CR: Mrs. Elizabeth Deer McCarrier, d. June 11, 1951, 90y 10m 7da', 'high'
FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start = 42 AND name_text = 'McCARRIER/DEER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start IN (18, 29, 34, 38, 42) AND name_text IN ('RINGEISEN', 'RICE', 'McCLINTOCK', 'MCCLINTOCK', 'McCARRIER/DEER')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 190 AND source_line_start IN (5, 13, 34, 42, 50) AND name_text IN ('WOOMER', 'DePRIEST', 'McCLINTOCK', 'McCARRIER/DEER', 'DEER');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
