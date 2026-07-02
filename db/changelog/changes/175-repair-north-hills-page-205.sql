--liquibase formatted sql

--changeset cemeterymapping:175-repair-north-hills-page-205 splitStatements:false
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$FORD/BERINGER (6C, 10, s) upright, gray granite, exc cond, band lozenges "Mother / Amelia E. Beringer / wife of / John E. Ford / 1882- 1916" CR: d. November 30, 1916$nhg$,
  inscription_text = $nhg$Mother / Amelia E. Beringer / wife of / John E. Ford / 1882- 1916$nhg$,
  updated_at = now()
WHERE source_page_index = 26
  AND source_page_number = 205
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 10
  AND name_text = 'FORD/BERINGER';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HIEBER (6C, 12, c) pillow, gray granite, exc cond, cross, grapes, leaves "Hieber / George / 1865-1936 / Olive / 1871-1953"$nhg$,
  inscription_text = $nhg$Hieber / George / 1865-1936 / Olive / 1871-1953$nhg$,
  parsed_years = ARRAY[1865, 1871, 1936, 1953]::integer[],
  updated_at = now()
WHERE source_page_index = 26
  AND source_page_number = 205
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 12
  AND name_text = 'HIEBER';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HIEBER (6C, 13, s) pillow, gray granite, exc cond "George W. Hieber / T / Sgt. 244th BU AAF / enlisted / Oct. 9, 1942 / born Oct. 28, 1906 / discharged / Oct 11, 1945 / died May 13, 1961" Separate flag holder: "World War II, eagle$nhg$,
  inscription_text = $nhg$George W. Hieber / T / Sgt. 244th BU AAF / enlisted / Oct. 9, 1942 / born Oct. 28, 1906 / discharged / Oct 11, 1945 / died May 13, 1961$nhg$,
  parsed_years = ARRAY[1906, 1942, 1945, 1961]::integer[],
  updated_at = now()
WHERE source_page_index = 26
  AND source_page_number = 205
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 13
  AND name_text = 'HIEBER';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SARVER/BROERMAN (6C, 14, c) upright, gray granite, exc cond, candle, flowers, leaves "Sarver / James M. / 1871-1948 / Father /  Margaret E. / 1873-1958 / Mother" CR: James, d. February 26, 1948, 75y 2mo. Margaret Broerman Sarver, d. December 7, 1958, 85y 1m 27d$nhg$,
  inscription_text = $nhg$Sarver / James M. / 1871-1948 / Father /  Margaret E. / 1873-1958 / Mother$nhg$,
  updated_at = now()
WHERE source_page_index = 26
  AND source_page_number = 205
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 14
  AND name_text = 'SARVER/BROERMAN';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(replace(fact.fact_value, '85y lm 27da', '85y 1m 27d'), '85y lm 27d', '85y 1m 27d'),
  raw_text = replace(replace(fact.raw_text, '85y lm 27da', '85y 1m 27d'), '85y lm 27d', '85y 1m 27d'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 26
  AND entry.source_page_number = 205
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 6
  AND entry.parsed_position_number = 14
  AND entry.name_text = 'SARVER/BROERMAN'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SCHUESSLER (6C, 15, s) upright, gray granite, exc cond, cross, lily, leaves "Armella 'June' / Schuessler / Sept. 30, 1936 / Sept. 10, 1984 / Beloved wife & mother" Black wrought Iron plant holder$nhg$,
  inscription_text = $nhg$Armella 'June' / Schuessler / Sept. 30, 1936 / Sept. 10, 1984 / Beloved wife & mother$nhg$,
  parse_notes = ARRAY[]::text[],
  updated_at = now()
WHERE source_page_index = 26
  AND source_page_number = 205
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 15
  AND name_text = 'SCHUESSLER';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$BROERMAN (6C, 16, s) upright, gray granite, exc cond "Harry T. Broerman / 1891-1923 / Sargt. Co. C 8, Field Div. / Signal Corps" Separate flag holder: "American / US / Legion", star CR: Harry Theodore, d. November 7, 1923, 33y 8m 13da$nhg$,
  inscription_text = $nhg$Harry T. Broerman / 1891-1923 / Sargt. Co. C 8, Field Div. / Signal Corps$nhg$,
  updated_at = now()
WHERE source_page_index = 26
  AND source_page_number = 205
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 16
  AND name_text = 'BROERMAN';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '33y Sm 13da', '33y 8m 13da'),
  raw_text = replace(fact.raw_text, '33y Sm 13da', '33y 8m 13da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 26
  AND entry.source_page_number = 205
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 6
  AND entry.parsed_position_number = 16
  AND entry.name_text = 'BROERMAN'
  AND fact.source_code = 'CR';

WITH merged_beringer AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 26
    AND source_page_number = 205
    AND parsed_section_name = 'C'
    AND parsed_row_number = 6
    AND parsed_position_number = 18
    AND name_text = 'BERINGER'
    AND raw_text LIKE '%BERINGER (6C,'' 19,%'
),
trimmed_beringer AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = 48,
    raw_text = $nhg$BERINGER (6C, 18, s) upright, gray granite, exc cond, scrolls, flower in window "Balthasar / Beringer / 1847-1925" CR: Baltzar, d. January 11, 1925, 77y 7m 23da$nhg$,
    inscription_text = $nhg$Balthasar / Beringer / 1847-1925$nhg$,
    parsed_years = ARRAY[1847, 1925]::integer[],
    updated_at = now()
  FROM merged_beringer
  WHERE entry.id = merged_beringer.id
  RETURNING entry.id, entry.batch_id, merged_beringer.cemetery_id
),
removed_beringer_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING trimmed_beringer
  WHERE fact.entry_id = trimmed_beringer.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
),
inserted_beringer_18_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Baltzar, d. January 11, 1925, 77y 7m 23da', NULL::date, 'CR: Baltzar, d. January 11, 1925, 77y 7m 23da', 'review'
  FROM trimmed_beringer
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'January 11, 1925', DATE '1925-01-11', 'CR: Baltzar, d. January 11, 1925, 77y 7m 23da', 'high'
  FROM trimmed_beringer
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
),
inserted_beringer_19 AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    26,
    205,
    49,
    51,
    $nhg$BERINGER (6C, 19, s) upright, gray granite, exc cond, scrolls "Katherine / Beringer 1859-1943" CR: d. January 17, 1943$nhg$,
    'BERINGER',
    ARRAY['BERINGER']::text[],
    'C',
    6,
    19,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Katherine / Beringer 1859-1943$nhg$,
    ARRAY[1859, 1943]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'BERINGER (6C, 19, s) upright, gray granite, exc cond, scrolls', 'descriptor', 'upright, gray granite, exc cond, scrolls')
  FROM trimmed_beringer
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = trimmed_beringer.batch_id
      AND existing.source_page_index = 26
      AND existing.source_page_number = 205
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 6
      AND existing.parsed_position_number = 19
      AND existing.name_text = 'BERINGER'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. January 17, 1943', NULL::date, 'CR: d. January 17, 1943', 'review'
FROM inserted_beringer_19
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'January 17, 1943', DATE '1943-01-17', 'CR: d. January 17, 1943', 'high'
FROM inserted_beringer_19
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 26 AND source_page_number = 205 AND name_text = 'BERINGER' AND parsed_position_number IN (18, 19)) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 26 AND source_page_number = 205 AND name_text = 'BERINGER' AND parsed_position_number = 19;
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
