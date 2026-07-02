--liquibase formatted sql

--changeset cemeterymapping:180-repair-north-hills-page-208 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 29
    AND source_page_number = 208
),
inserted_kummer_9 AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    29,
    208,
    10,
    14,
    $nhg$KUMMER (8C, 9, c) upright, gray granite, exc cond, flowers "Kummer / George H. / 1860-1903 / Father / Margaret E. / 1870-1959 / Mother / Chester T. / 1901-1921 / Son" On back: "Kummer" CR: Margaret, d. January 16, 1959, 88y 9m 10da$nhg$,
    'KUMMER',
    ARRAY['KUMMER']::text[],
    'C',
    8,
    9,
    'couple',
    'upright',
    'granite',
    'excellent',
    $nhg$Kummer / George H. / 1860-1903 / Father / Margaret E. / 1870-1959 / Mother / Chester T. / 1901-1921 / Son Kummer$nhg$,
    ARRAY[1860, 1870, 1901, 1903, 1921, 1959]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'KUMMER (8C, 9, c) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers')
  FROM page_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = 29
      AND existing.source_page_number = 208
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 8
      AND existing.parsed_position_number = 9
      AND existing.name_text = 'KUMMER'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
),
inserted_kummer_9_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Margaret, d. January 16, 1959, 88y 9m 10da', NULL::date, 'CR: Margaret, d. January 16, 1959, 88y 9m 10da', 'review'
  FROM inserted_kummer_9
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'January 16, 1959', DATE '1959-01-16', 'CR: Margaret, d. January 16, 1959, 88y 9m 10da', 'high'
  FROM inserted_kummer_9
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_kummer_9_facts;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 18,
  parsed_row_number = 8,
  raw_text = $nhg$KUMMER (8C, 10, s) upright, gray granite, exc cond "Dora Kummer / 1826-1926" On common base with (8C, 11). CR: Dorothy, d. September 18, 1926$nhg$,
  inscription_text = $nhg$Dora Kummer / 1826-1926$nhg$,
  parsed_years = ARRAY[1826, 1926]::integer[],
  source_entry = jsonb_build_object('heading', 'KUMMER (8C, 10, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 29
  AND source_page_number = 208
  AND parsed_section_name = 'C'
  AND parsed_row_number = 5
  AND parsed_position_number = 10
  AND name_text = 'KUMMER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = CASE
    WHEN fact.fact_type = 'death_date' THEN 'September 18, 1926'
    ELSE 'Dorothy, d. September 18, 1926'
  END,
  raw_text = 'CR: Dorothy, d. September 18, 1926',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 29
  AND entry.source_page_number = 208
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 8
  AND entry.parsed_position_number = 10
  AND entry.name_text = 'KUMMER'
  AND fact.source_code = 'CR';

WITH kummer_10 AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 29
    AND source_page_number = 208
    AND parsed_section_name = 'C'
    AND parsed_row_number = 8
    AND parsed_position_number = 10
    AND name_text = 'KUMMER'
),
inserted_kummer_11 AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    29,
    208,
    20,
    23,
    $nhg$KUMMER (8C, 11, s) upright, gray granite, exc cond "Christ Kummer / 1827-1895" On common base with (BC, 10). CRG: Christian Kummer, b. 16 March 1827 in Krahenbhal. Al Württemberg, d. 22 February 1895, age 67y 11m 8da, f. February 22, 1895$nhg$,
    'KUMMER',
    ARRAY['KUMMER']::text[],
    'C',
    8,
    11,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Christ Kummer / 1827-1895$nhg$,
    ARRAY[1827, 1895]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'KUMMER (8C, 11, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond')
  FROM kummer_10
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = kummer_10.batch_id
      AND existing.source_page_index = 29
      AND existing.source_page_number = 208
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 8
      AND existing.parsed_position_number = 11
      AND existing.name_text = 'KUMMER'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CRG', 'Church Records in German', 'note', 'Christian Kummer, b. 16 March 1827 in Krahenbhal. Al Württemberg, d. 22 February 1895, age 67y 11m 8da, f. February 22, 1895', NULL::date, 'CRG: Christian Kummer, b. 16 March 1827 in Krahenbhal. Al Württemberg, d. 22 February 1895, age 67y 11m 8da, f. February 22, 1895', 'review'
FROM inserted_kummer_11
UNION ALL
SELECT id, 'CRG', 'Church Records in German', 'death_date', '22 February 1895', DATE '1895-02-22', 'CRG: Christian Kummer, b. 16 March 1827 in Krahenbhal. Al Württemberg, d. 22 February 1895, age 67y 11m 8da, f. February 22, 1895', 'high'
FROM inserted_kummer_11
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$GRAHAM/STEELE (9C, 1, s) upright, gray granite, exc cond, flowers "Mother / 1897·1973 / Pearl Steele / Graham / God bless you" CR: d. April 19, 1973, 76y 1m 24da$nhg$,
  inscription_text = $nhg$Mother / 1897·1973 / Pearl Steele / Graham / God bless you$nhg$,
  updated_at = now()
WHERE source_page_index = 29
  AND source_page_number = 208
  AND parsed_section_name = 'C'
  AND parsed_row_number = 9
  AND parsed_position_number = 1
  AND name_text = 'GRAHAM/STEELE';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '76y lm 24da', '76y 1m 24da'),
  raw_text = replace(fact.raw_text, '76y lm 24da', '76y 1m 24da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 29
  AND entry.source_page_number = 208
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 9
  AND entry.parsed_position_number = 1
  AND entry.name_text = 'GRAHAM/STEELE'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$BROERMAN (9C, 3, s) pillow, bronze over stone, poor cond, US American Legion rosette "Joseph L. Broerman/ Private / Co. 1 / 161st / Infantry / enlisted July 23, 1918 discharged Mar. 4, 1919 / born June 14, 1886 died July 4, 1934"$nhg$,
  inscription_text = $nhg$Joseph L. Broerman/ Private / Co. 1 / 161st / Infantry / enlisted July 23, 1918 discharged Mar. 4, 1919 / born June 14, 1886 died July 4, 1934$nhg$,
  updated_at = now()
WHERE source_page_index = 29
  AND source_page_number = 208
  AND parsed_section_name = 'C'
  AND parsed_row_number = 9
  AND parsed_position_number = 3
  AND name_text = 'BROERMAN';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$EADIE (9C, 4, s) flat, pink granite, exc cond, cross, flowers "Hilda G. Eadie/ Nov. 18, 1929 / Aug. 28, 1988 / Beloved Mother / and Stepmother''$nhg$,
  inscription_text = $nhg$Hilda G. Eadie/ Nov. 18, 1929 / Aug. 28, 1988 / Beloved Mother / and Stepmother'$nhg$,
  updated_at = now()
WHERE source_page_index = 29
  AND source_page_number = 208
  AND parsed_section_name = 'C'
  AND parsed_row_number = 9
  AND parsed_position_number = 4
  AND name_text = 'EADIE';

UPDATE north_hills_ocr_entries
SET
  parse_notes = array_append(
    array_remove(COALESCE(parse_notes, ARRAY[]::text[]), 'A two foot high statue of a seated child with a basket in its lap is located in line with other tombstones in this row, at this place. The stone is weathered and there is no inscription. Stone 9C, 4, which is now missing, was located at what would be the foot of this grave. No stone with this inscription was found on second reading, only a flat spot in the earth. See previous paragraph. See also the note with (8C, 1), William L Eadie.'),
    'A two foot high statue of a seated child with a basket in its lap is located in line with other tombstones in this row, at this place. The stone is weathered and there is no inscription. Stone 9C, 4, which is now missing, was located at what would be the foot of this grave. No stone with this inscription was found on second reading, only a flat spot in the earth. See previous paragraph. See also the note with (8C, 1), William L Eadie.'
  ),
  updated_at = now()
WHERE source_page_index = 29
  AND source_page_number = 208
  AND parsed_section_name = 'C'
  AND parsed_row_number = 9
  AND parsed_position_number IN (3, 4)
  AND name_text IN ('BROERMAN', 'EADIE');

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 29 AND source_page_number = 208 AND parsed_row_number = 8 AND parsed_position_number IN (9, 11)) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 29 AND source_page_number = 208 AND parsed_row_number = 8 AND parsed_position_number IN (9, 11);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
