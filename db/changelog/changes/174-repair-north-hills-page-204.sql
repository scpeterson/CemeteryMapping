--liquibase formatted sql

--changeset cemeterymapping:174-repair-north-hills-page-204 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 25
    AND source_page_number = 204
),
inserted_harris AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    25,
    204,
    7,
    10,
    $nhg$HARRIS (5C, 9, s) flat, bronze, exc cond "Lester C Harris / Pfc US Army/ World War II / Aug 14 1926 Apr 16, 1989" CR: Middle name, Clyde$nhg$,
    'HARRIS',
    ARRAY['HARRIS']::text[],
    'C',
    5,
    9,
    'single',
    'flat',
    'bronze',
    'excellent',
    $nhg$Lester C Harris / Pfc US Army/ World War II / Aug 14 1926 Apr 16, 1989$nhg$,
    ARRAY[1926, 1989]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'HARRIS (5C, 9, s) flat, bronze, exc cond', 'descriptor', 'flat, bronze, exc cond')
  FROM page_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = 25
      AND existing.source_page_number = 204
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 5
      AND existing.parsed_position_number = 9
      AND existing.name_text = 'HARRIS'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Middle name, Clyde', 'CR: Middle name, Clyde', 'review'
FROM inserted_harris
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WISKEMAN (6C, 1, c) upright, gray granite, exc cond, flower, leaves "Wiskeman / William C. / 1898-1955 / Edith L. / 1900-1992" CR: W. C. d. May 10, 1955 in Jonesboro, Ark., cremated and ashes buried June 6. Edith, Oct. 12, 1900 - July 18, 1992$nhg$,
  inscription_text = $nhg$Wiskeman / William C. / 1898-1955 / Edith L. / 1900-1992$nhg$,
  updated_at = now()
WHERE source_page_index = 25
  AND source_page_number = 204
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 1
  AND name_text = 'WISKEMAN';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$MURRAY (6C, 3, s) pillow, gray granite, exc cond "Infant son of / Martha & Herbert / Murray / died 1945" CR: Jeffry Herbert Murray, d. September 29, 1945, 2 ½ da$nhg$,
  inscription_text = $nhg$Infant son of / Martha & Herbert / Murray / died 1945$nhg$,
  updated_at = now()
WHERE source_page_index = 25
  AND source_page_number = 204
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 3
  AND name_text = 'MURRAY';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, ' •', ''),
  raw_text = replace(fact.raw_text, ' •', ''),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 25
  AND entry.source_page_number = 204
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 6
  AND entry.parsed_position_number = 3
  AND entry.name_text = 'MURRAY'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SOERGEL (6C, 6, s) upright, gray granite, exc cond, flower, leaves "Mother / Marie C. Soergel / July 8, 1897 / May 2, 1989"$nhg$,
  inscription_text = $nhg$Mother / Marie C. Soergel / July 8, 1897 / May 2, 1989$nhg$,
  updated_at = now()
WHERE source_page_index = 25
  AND source_page_number = 204
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 6
  AND name_text = 'SOERGEL';

WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 25
    AND source_page_number = 204
),
inserted_ford_rhodes AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    25,
    204,
    45,
    47,
    $nhg$FORD/RHODES (6C, 8, s) upright, gray granite, exc cond, flower, leaves "Hanna Ford / June 10, 1893 / Sept. 5, 1953 / Mother" CR: Mrs. Hannah Rhodes Ford$nhg$,
    'FORD/RHODES',
    ARRAY['FORD','RHODES']::text[],
    'C',
    6,
    8,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Hanna Ford / June 10, 1893 / Sept. 5, 1953 / Mother$nhg$,
    ARRAY[1893, 1953]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'FORD/RHODES (6C, 8, s) upright, gray granite, exc cond, flower, leaves', 'descriptor', 'upright, gray granite, exc cond, flower, leaves')
  FROM page_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = 25
      AND existing.source_page_number = 204
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 6
      AND existing.parsed_position_number = 8
      AND existing.name_text = 'FORD/RHODES'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Mrs. Hannah Rhodes Ford', 'CR: Mrs. Hannah Rhodes Ford', 'review'
FROM inserted_ford_rhodes
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$FORD (6C, 9, s) upright, gray granite, exc cond, flower, leaves "John E. Ford / 1885-1971"$nhg$,
  inscription_text = $nhg$John E. Ford / 1885-1971$nhg$,
  parsed_years = ARRAY[1885, 1971]::integer[],
  updated_at = now()
WHERE source_page_index = 25
  AND source_page_number = 204
  AND parsed_section_name = 'C'
  AND parsed_row_number = 6
  AND parsed_position_number = 9
  AND name_text = 'FORD';

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 25 AND source_page_number = 204 AND name_text IN ('HARRIS','FORD/RHODES')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 25 AND source_page_number = 204 AND name_text IN ('HARRIS','FORD/RHODES');
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
