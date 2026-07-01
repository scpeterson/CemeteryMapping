--liquibase formatted sql

--changeset cemeterymapping:173-repair-north-hills-page-203 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 24
    AND source_page_number = 203
),
inserted_wittmer AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    24,
    203,
    7,
    9,
    $nhg$WITTMER/WITMER (4C, 17, s) pillow, gray granite, exc cond "Barbara Wittmer/ 1854-1925 / Mother" CR: Barbara Witmer, d. & buried April 21, 1925$nhg$,
    'WITTMER/WITMER',
    ARRAY['WITTMER','WITMER']::text[],
    'C',
    4,
    17,
    'single',
    'pillow',
    'granite',
    'excellent',
    $nhg$Barbara Wittmer/ 1854-1925 / Mother$nhg$,
    ARRAY[1854, 1925]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'WITTMER/WITMER (4C, 17, s) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond')
  FROM page_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = 24
      AND existing.source_page_number = 203
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 4
      AND existing.parsed_position_number = 17
      AND existing.name_text = 'WITTMER/WITMER'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Barbara Witmer, d. & buried April 21, 1925', NULL::date, 'CR: Barbara Witmer, d. & buried April 21, 1925', 'review'
FROM inserted_wittmer
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'April 21, 1925', DATE '1925-04-21', 'CR: Barbara Witmer, d. & buried April 21, 1925', 'high'
FROM inserted_wittmer
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  source_line_start = 10,
  source_line_end = 14,
  raw_text = $nhg$SARVER (4C, 18, c) upright, gray granite, exc cond, scroll, ivy "Philip Sarver / 1858-1919 / Catherine, his wife / 1865-1927" CR: Philip B., d. February 8, 1919, 61y. Catherine, d. January 27, 1927$nhg$,
  inscription_text = $nhg$Philip Sarver / 1858-1919 / Catherine, his wife / 1865-1927$nhg$,
  source_entry = jsonb_build_object('heading', 'SARVER (4C, 18, c) upright, gray granite, exc cond, scroll, ivy', 'descriptor', 'upright, gray granite, exc cond, scroll, ivy'),
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 18
  AND name_text = 'SARVER';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HAGUE (4C, 20, c) upright, gray granite, exc cond, ivy "Hague/ Laverne J. / 1897-1974 / Father / Clara H. / 1897-1948 / Mother" On back: "Hague" CR: Laverne, d. June· 1, 1974$nhg$,
  inscription_text = $nhg$Hague/ Laverne J. / 1897-1974 / Father / Clara H. / 1897-1948 / Mother$nhg$,
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 20
  AND name_text = 'HAGUE';

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 5,
  raw_text = $nhg$SOERGEL (5C, 1, c) upright, gray granite, exc cond, flowers "Soergel / Kenneth B. / Dec. 12, 1932 / Apr. 1993 / Clara Pearle / May 24, 1932 [blank]" On back: "Soergel" Separate flag holder: "US / Veteran" CR: Kenneth, d. April 17, 1993$nhg$,
  inscription_text = $nhg$Soergel / Kenneth B. / Dec. 12, 1932 / Apr. 1993 / Clara Pearle / May 24, 1932 [blank]$nhg$,
  source_entry = jsonb_build_object('heading', 'SOERGEL (5C, 1, c) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_position_number = 1
  AND name_text = 'SOERGEL';

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 5,
  raw_text = $nhg$SOERGEL (5C, 2, c) flat, bronze, exc cond, roses "Howard L. / 1898- 1968 / Elsie G. / 1900-1986 / Soergel" CR: Howard, d, November 9, 1968, 70y 3m 7da. Elsie, Jan. 2, 1900 - September 15, 1986$nhg$,
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_position_number = 2
  AND name_text = 'SOERGEL';

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 5,
  raw_text = $nhg$SOERGEL (5C, 3, c) upright, gray granite, exc cond, rose "Soergel / Wilbert J. / 1891-1968 / Father / Hazel A. / 1892-1983 / Mother" On back: "Soergel" CR: Hazel, d. March 16, 1983, 90y 9m 21da$nhg$,
  inscription_text = $nhg$Soergel / Wilbert J. / 1891-1968 / Father / Hazel A. / 1892-1983 / Mother$nhg$,
  source_entry = jsonb_build_object('heading', 'SOERGEL (5C, 3, c) upright, gray granite, exc cond, rose', 'descriptor', 'upright, gray granite, exc cond, rose'),
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_position_number = 3
  AND name_text = 'SOERGEL';

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 5,
  raw_text = $nhg$MURRAY (5C, 4, s) upright, gray granite, exc cond "M / Charles W. / Murray / 1879-1919" On back: "Murray" CR: d. February 14, 1919$nhg$,
  inscription_text = $nhg$M / Charles W. / Murray / 1879-1919$nhg$,
  source_entry = jsonb_build_object('heading', 'MURRAY (5C, 4, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_position_number = 4
  AND name_text = 'MURRAY';

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 5,
  raw_text = $nhg$STEWART/MURRAY/WATENPOOL (5C, S, s) upright, gray, exc cond, flowers "Mother/ Hilda Murray / Stewart / July 27, 1888 / June 13, 1970'' CR: Hilda Watenpool Stewart, d. June 13, 1970$nhg$,
  inscription_text = $nhg$Mother/ Hilda Murray / Stewart / July 27, 1888 / June 13, 1970$nhg$,
  source_entry = jsonb_build_object('heading', 'STEWART/MURRAY/WATENPOOL (5C, S, s) upright, gray, exc cond, flowers', 'descriptor', 'upright, gray, exc cond, flowers'),
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_position_number = 5
  AND name_text = 'STEWART/MURRAY/WATENPOOL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, 'Ste.wart', 'Stewart'),
  raw_text = replace(fact.raw_text, 'Ste.wart', 'Stewart'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 24
  AND entry.source_page_number = 203
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 5
  AND entry.parsed_position_number = 5
  AND entry.name_text = 'STEWART/MURRAY/WATENPOOL'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 5,
  raw_text = $nhg$MURRAY (5C, 6, c) flat, gray granite, exc cond, flowers "Murray / C. Wesley / Oct. 9, 1915 / Feb. 15, 2005 / Helen I. / May 23, 1913 / June 17, 2003" CR: Helen, birthdate, May 28$nhg$,
  inscription_text = $nhg$Murray / C. Wesley / Oct. 9, 1915 / Feb. 15, 2005 / Helen I. / May 23, 1913 / June 17, 2003$nhg$,
  source_entry = jsonb_build_object('heading', 'MURRAY (5C, 6, c) flat, gray granite, exc cond, flowers', 'descriptor', 'flat, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_index = 24
  AND source_page_number = 203
  AND parsed_section_name = 'C'
  AND parsed_position_number = 6
  AND name_text = 'MURRAY';

WITH bleakley_batches AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 24
    AND source_page_number = 203
    AND parsed_section_name = 'C'
    AND parsed_position_number = 7
    AND name_text = 'BLEAKLEY'
    AND raw_text LIKE '%McCLELLAND/SARVER%'
),
trimmed_bleakley AS (
  UPDATE north_hills_ocr_entries entry
  SET
    parsed_row_number = 5,
    source_line_end = 51,
    raw_text = $nhg$BLEAKLEY (5C, 7, c) upright, gray granite, exc cond, flowers "Bleakley/ Adam / 1875-1939 / Father/  Effie / 1885-1944 / Mother''$nhg$,
    inscription_text = $nhg$Bleakley/ Adam / 1875-1939 / Father/  Effie / 1885-1944 / Mother$nhg$,
    parsed_years = ARRAY[1875, 1885, 1939, 1944]::integer[],
    source_entry = jsonb_build_object('heading', 'BLEAKLEY (5C, 7, c) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers'),
    updated_at = now()
  FROM bleakley_batches
  WHERE entry.id = bleakley_batches.id
  RETURNING entry.id, entry.batch_id, bleakley_batches.cemetery_id
),
removed_bleakley_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING trimmed_bleakley
  WHERE fact.entry_id = trimmed_bleakley.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
),
inserted_mcclelland AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    24,
    203,
    52,
    54,
    $nhg$McCLELLAND/SARVER (5C, 8, s) upright, gray granite, exc cond "Clara R. / Sarver / McClelland / 1868-1916" CR: d. January 28, 1916$nhg$,
    'McCLELLAND/SARVER',
    ARRAY['MCCLELLAND','SARVER']::text[],
    'C',
    5,
    8,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Clara R. / Sarver / McClelland / 1868-1916$nhg$,
    ARRAY[1868, 1916]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'McCLELLAND/SARVER (5C, 8, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond')
  FROM trimmed_bleakley
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = trimmed_bleakley.batch_id
      AND existing.source_page_index = 24
      AND existing.source_page_number = 203
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 5
      AND existing.parsed_position_number = 8
      AND existing.name_text = 'McCLELLAND/SARVER'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. January 28, 1916', NULL::date, 'CR: d. January 28, 1916', 'review'
FROM inserted_mcclelland
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'January 28, 1916', DATE '1916-01-28', 'CR: d. January 28, 1916', 'high'
FROM inserted_mcclelland
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 24 AND source_page_number = 203 AND name_text IN ('WITTMER/WITMER','McCLELLAND/SARVER')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 24 AND source_page_number = 203 AND name_text IN ('WITTMER/WITMER','McCLELLAND/SARVER');
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
