--liquibase formatted sql

--changeset cemeterymapping:163-repair-north-hills-page-195
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$BRANDT (3B, 20, s) upright, gray granite, exc cond. On top·: "Baby" On front: "Russell L. Brandt/ born/ Mar. 20, 1897 / died Jun,e 13., 1897" Cement slab in front of stone. Could be a base. CRG: Russel Layton Brandt b. 20 March 1897, d. 13 June 1897, buried 15 June, age 2m 23da$nhg$,
  inscription_text = $nhg$Baby Russell L. Brandt/ born/ Mar. 20, 1897 / died Jun,e 13., 1897$nhg$,
  parse_notes = ARRAY['Plot marker: "H" is a separate marker observation from the NHG text and is not part of this stone entry.']::text[],
  source_entry = jsonb_build_object('heading', 'BRANDT (3B, 20, s) upright, gray granite, exc cond. On top·:', 'descriptor', 'upright, gray granite, exc cond. On top·:'),
  updated_at = now()
WHERE source_page_index = 16
  AND source_page_number = 195
  AND source_line_start = 5
  AND name_text = 'BRANDT';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = 'Russel Layton Brandt b. 20 March 1897, d. 13 June 1897, buried 15 June, age 2m 23da',
  raw_text = 'CRG: Russel Layton Brandt b. 20 March 1897, d. 13 June 1897, buried 15 June, age 2m 23da',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 16
  AND entry.source_page_number = 195
  AND entry.source_line_start = 5
  AND entry.name_text = 'BRANDT'
  AND fact.source_code = 'CRG';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 24,
  raw_text = $nhg$HIEBER (3B, 23, s) upright, black marble, poor cond, sunken, fallen, heart "Esther / dau. of / D. L. & A. C. Hieber/ Nov. 15, 1898 / Dec. 16, 1905" Note: Stone located at foot of (3B, 22)$nhg$,
  inscription_text = $nhg$Esther / dau. of / D. L. & A. C. Hieber/ Nov. 15, 1898 / Dec. 16, 1905$nhg$,
  parsed_years = ARRAY[1898, 1905]::integer[],
  source_entry = jsonb_build_object('heading', 'HIEBER (3B, 23, s) upright, black marble, poor cond, sunken, fallen, heart', 'descriptor', 'upright, black marble, poor cond, sunken, fallen, heart'),
  updated_at = now()
WHERE source_page_index = 16
  AND source_page_number = 195
  AND source_line_start = 21
  AND name_text = 'HIEBER';

DELETE FROM north_hills_ocr_source_facts fact
USING north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 16
  AND entry.source_page_number = 195
  AND entry.source_line_start = 21
  AND entry.name_text = 'HIEBER'
  AND fact.source_code = 'CR';

WITH page_195_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 16
    AND source_page_number = 195
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  195,
  26,
  29,
  $nhg$HIEBER (3B, 24, s) upright, black marble, poor cond, sunken., fallen., heart "Alfred/ son of / D. L. & A. C. Hieber/ May 10, 1906 / June 24 / 1909" Note: Stone located at foot o( (3B, 22) CR: Alfred David$nhg$,
  'HIEBER',
  ARRAY['HIEBER']::text[],
  'B',
  3,
  24,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Alfred/ son of / D. L. & A. C. Hieber/ May 10, 1906 / June 24 / 1909$nhg$,
  ARRAY[1906, 1909]::integer[],
  'high',
  ARRAY['Plot marker "H" is a separate marker observation from the NHG text and is not part of this stone entry.']::text[],
  jsonb_build_object('heading', 'HIEBER (3B, 24, s) upright, black marble, poor cond, sunken., fallen., heart', 'descriptor', 'upright, black marble, poor cond, sunken., fallen., heart')
FROM page_195_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'note',
  'Alfred David',
  'CR: Alfred David',
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 16
  AND source_page_number = 195
  AND source_line_start = 26
  AND name_text = 'HIEBER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 37,
  raw_text = $nhg$SCHNABEL/VOGAL (3B, 25, s) upright, gray granite, exc concl "Carl Schnabel/ born/ March 12, 1867, /died/ Jan. 22, 1895." CRG: Carl Schnabel, son of Philipp & wife Maria Katharina nee Vogal, b. 12 March 1867 in Allegheny Co. Pa., d. 22 January 1895 In Pittsburgh, age 27y 10m 10da, f. January 22$nhg$,
  inscription_text = $nhg$Carl Schnabel/ born/ March 12, 1867, /died/ Jan. 22, 1895.$nhg$,
  parsed_years = ARRAY[1867, 1895]::integer[],
  source_entry = jsonb_build_object('heading', 'SCHNABEL/VOGAL (3B, 25, s) upright, gray granite, exc concl', 'descriptor', 'upright, gray granite, exc concl'),
  updated_at = now()
WHERE source_page_index = 16
  AND source_page_number = 195
  AND source_line_start = 33
  AND name_text = 'SCHNABEL/VOGAL';

DELETE FROM north_hills_ocr_source_facts fact
USING north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 16
  AND entry.source_page_number = 195
  AND entry.source_line_start = 33
  AND entry.name_text = 'SCHNABEL/VOGAL'
  AND fact.source_code = 'CR';

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CRG',
  'Church Records in German',
  'note',
  'Carl Schnabel, son of Philipp & wife Maria Katharina nee Vogal, b. 12 March 1867 in Allegheny Co. Pa., d. 22 January 1895 In Pittsburgh, age 27y 10m 10da, f. January 22',
  'CRG: Carl Schnabel, son of Philipp & wife Maria Katharina nee Vogal, b. 12 March 1867 in Allegheny Co. Pa., d. 22 January 1895 In Pittsburgh, age 27y 10m 10da, f. January 22',
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 16
  AND source_page_number = 195
  AND source_line_start = 33
  AND name_text = 'SCHNABEL/VOGAL'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH page_195_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 16
    AND source_page_number = 195
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  195,
  39,
  40,
  $nhg$SCHNABEL (38, 26, s) upright with open ledger, gray granite, ,exc cond "Henry Schnabel / 1856-1904"$nhg$,
  'SCHNABEL',
  ARRAY['SCHNABEL']::text[],
  'B',
  3,
  26,
  'single',
  'upright, ledger',
  'granite',
  'excellent',
  $nhg$Henry Schnabel / 1856-1904$nhg$,
  ARRAY[1856, 1904]::integer[],
  'high',
  ARRAY['NHG OCR/location text uses "38"; parsed as row 3, section B.']::text[],
  jsonb_build_object('heading', 'SCHNABEL (38, 26, s) upright with open ledger, gray granite, ,exc cond', 'descriptor', 'upright with open ledger, gray granite, ,exc cond')
FROM page_195_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

WITH page_195_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 16
    AND source_page_number = 195
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  195,
  43,
  45,
  $nhg$LOEFFL'ER (4B, 1, s) upright, white marble, poor cond, sunken, fallen, lamb "John E / [-] / Loeffler / [-] / [-] Aug. 1887 / [2 Illegible lines]"$nhg$,
  $nhg$LOEFFL'ER$nhg$,
  ARRAY[$nhg$LOEFFL'ER$nhg$]::text[],
  'B',
  4,
  1,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$John E / [-] / Loeffler / [-] / [-] Aug. 1887 / [2 Illegible lines]$nhg$,
  ARRAY[1887]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', $nhg$LOEFFL'ER (4B, 1, s) upright, white marble, poor cond, sunken, fallen, lamb$nhg$, 'descriptor', 'upright, white marble, poor cond, sunken, fallen, lamb')
FROM page_195_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

WITH page_195_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 16
    AND source_page_number = 195
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  195,
  46,
  47,
  $nhg$LOEFFLER (4B, 2, s) upright, white marble, poor cond, sunken, fallen, lamb "Frank J. / [-] / Loeffler/ [3 illegible lines]"$nhg$,
  'LOEFFLER',
  ARRAY['LOEFFLER']::text[],
  'B',
  4,
  2,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Frank J. / [-] / Loeffler/ [3 illegible lines]$nhg$,
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', 'LOEFFLER (4B, 2, s) upright, white marble, poor cond, sunken, fallen, lamb', 'descriptor', 'upright, white marble, poor cond, sunken, fallen, lamb')
FROM page_195_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$LOEFFLER (4B, 3, s) upright, gray granite, good cond, leaves, wheel "Elizebeth/ Loeffler/ 1851-1911 /A. noble wife &./ Devoted mother / At rest'' CR: d. March 2, 1911, 59y$nhg$,
  inscription_text = $nhg$Elizebeth/ Loeffler/ 1851-1911 /A. noble wife &./ Devoted mother / At rest'$nhg$,
  parsed_years = ARRAY[1851, 1911]::integer[],
  source_entry = jsonb_build_object('heading', 'LOEFFLER (4B, 3, s) upright, gray granite, good cond, leaves, wheel', 'descriptor', 'upright, gray granite, good cond, leaves, wheel'),
  updated_at = now()
WHERE source_page_index = 16
  AND source_page_number = 195
  AND source_line_start = 49
  AND name_text = 'LOEFFLER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '1911,.59y', '1911, 59y'),
  raw_text = replace(fact.raw_text, '1911,.59y', '1911, 59y'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 16
  AND entry.source_page_number = 195
  AND entry.source_line_start = 49
  AND entry.name_text = 'LOEFFLER'
  AND fact.source_code = 'CR';

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 16 AND source_page_number = 195 AND source_line_start IN (26, 33));
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 16 AND source_page_number = 195 AND source_line_start IN (26, 39, 43, 46);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
