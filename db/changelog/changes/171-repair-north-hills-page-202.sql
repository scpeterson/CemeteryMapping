--liquibase formatted sql

--changeset cemeterymapping:171-repair-north-hills-page-202 splitStatements:false
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HAGUE (4C, 5, s) upright, gray granite, exc cond, flower spray "Amanda L. Hague / 1886-1929" CR: d. June 30, 1929$nhg$,
  inscription_text = $nhg$Amanda L. Hague / 1886-1929$nhg$,
  source_entry = jsonb_build_object('heading', 'HAGUE (4C, 5, s) upright, gray granite, exc cond, flower spray', 'descriptor', 'upright, gray granite, exc cond, flower spray'),
  updated_at = now()
WHERE source_page_index = 23
  AND source_page_number = 202
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 5
  AND name_text = 'HAGUE';

UPDATE north_hills_ocr_entries
SET
  raw_text = replace(raw_text, 'S0y 7m 3da', '80y 7m 3da'),
  updated_at = now()
WHERE source_page_index = 23
  AND source_page_number = 202
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 6
  AND name_text = 'HAGUE/BROERMAN';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, 'S0y 7m 3da', '80y 7m 3da'),
  raw_text = replace(fact.raw_text, 'S0y 7m 3da', '80y 7m 3da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 23
  AND entry.source_page_number = 202
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 4
  AND entry.parsed_position_number = 6
  AND entry.name_text = 'HAGUE/BROERMAN'
  AND fact.source_code = 'CR';

WITH sarver_batches AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 23
    AND source_page_number = 202
    AND parsed_section_name = 'C'
    AND parsed_row_number = 4
    AND parsed_position_number = 7
    AND name_text = 'SARVER'
    AND raw_text LIKE '%TAYLOR/SARVER%'
),
trimmed_sarver AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = 13,
    raw_text = $nhg$SARVER (4C, 7, s) pillow, gray granite, exc cond "Father/ C. Dale Sarver / 1877-1944'' CR: Clarence Dale Sarver, d. January 5, 1944$nhg$,
    inscription_text = $nhg$Father/ C. Dale Sarver / 1877-1944$nhg$,
    source_entry = jsonb_build_object('heading', 'SARVER (4C, 7, s) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond'),
    updated_at = now()
  FROM sarver_batches
  WHERE entry.id = sarver_batches.id
  RETURNING entry.id, entry.batch_id, sarver_batches.cemetery_id
),
removed_sarver_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING trimmed_sarver
  WHERE fact.entry_id = trimmed_sarver.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
),
inserted_sarver_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Clarence Dale Sarver, d. January 5, 1944', NULL::date, 'CR: Clarence Dale Sarver, d. January 5, 1944', 'review'
  FROM trimmed_sarver
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'January 5, 1944', DATE '1944-01-05', 'CR: Clarence Dale Sarver, d. January 5, 1944', 'high'
  FROM trimmed_sarver
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
),
new_sarver_entries(batch_id, cemetery_id, source_line_start, source_line_end, raw_text, name_text, surnames, parsed_position_number, marker_scope, inscription_text, parsed_years, parse_notes, source_heading, source_descriptor) AS (
  SELECT
    sarver_batches.batch_id,
    sarver_batches.cemetery_id,
    reading.source_line_start,
    reading.source_line_end,
    reading.raw_text,
    reading.name_text,
    reading.surnames,
    reading.parsed_position_number,
    reading.marker_scope,
    reading.inscription_text,
    reading.parsed_years,
    reading.parse_notes,
    reading.source_heading,
    reading.source_descriptor
  FROM sarver_batches
  JOIN trimmed_sarver ON trimmed_sarver.batch_id = sarver_batches.batch_id
  CROSS JOIN (
    VALUES
      (14, 17, $nhg$TAYLOR/SARVER (4C, 8, s) pillow, gray granite, exc cond "Mother/ Olive Sarver / Taylor / 1888-1967" CR: d. April 2, 1967, 78y 4m 10da NOTE: Foundation stone(?), small concrete flat stone in ground, no inscription$nhg$, 'TAYLOR/SARVER', ARRAY['TAYLOR','SARVER']::text[], 8, 'single', $nhg$Mother/ Olive Sarver / Taylor / 1888-1967$nhg$, ARRAY[1888, 1967]::integer[], ARRAY['NOTE: Foundation stone(?), small concrete flat stone in ground, no inscription']::text[], 'TAYLOR/SARVER (4C, 8, s) pillow, gray granite, exc cond', 'pillow, gray granite, exc cond'),
      (18, 21, $nhg$BROERMAN/SCHARF (4C, 9, s) pillow, gray granite, exc cond "Mother / Marie B. Broerman / 1854-1944" CR: Marie Scharf, d. November 25, 1944$nhg$, 'BROERMAN/SCHARF', ARRAY['BROERMAN','SCHARF']::text[], 9, 'single', $nhg$Mother / Marie B. Broerman / 1854-1944$nhg$, ARRAY[1854, 1944]::integer[], ARRAY[]::text[], 'BROERMAN/SCHARF (4C, 9, s) pillow, gray granite, exc cond', 'pillow, gray granite, exc cond')
  ) AS reading(source_line_start, source_line_end, raw_text, name_text, surnames, parsed_position_number, marker_scope, inscription_text, parsed_years, parse_notes, source_heading, source_descriptor)
),
inserted_sarver_entries AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id, cemetery_id, 23, 202, source_line_start, source_line_end,
    raw_text, name_text, surnames, 'C', 4, parsed_position_number,
    marker_scope, 'pillow', 'granite', 'excellent', inscription_text, parsed_years,
    'high', parse_notes, jsonb_build_object('heading', source_heading, 'descriptor', source_descriptor)
  FROM new_sarver_entries
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = new_sarver_entries.batch_id
      AND existing.source_page_number = 202
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 4
      AND existing.parsed_position_number = new_sarver_entries.parsed_position_number
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id, name_text, source_line_start
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. April 2, 1967, 78y 4m 10da', NULL::date, 'CR: d. April 2, 1967, 78y 4m 10da', 'review'
FROM inserted_sarver_entries
WHERE name_text = 'TAYLOR/SARVER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'April 2, 1967', DATE '1967-04-02', 'CR: d. April 2, 1967, 78y 4m 10da', 'high'
FROM inserted_sarver_entries
WHERE name_text = 'TAYLOR/SARVER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Marie Scharf, d. November 25, 1944', NULL::date, 'CR: Marie Scharf, d. November 25, 1944', 'review'
FROM inserted_sarver_entries
WHERE name_text = 'BROERMAN/SCHARF'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'November 25, 1944', DATE '1944-11-25', 'CR: Marie Scharf, d. November 25, 1944', 'high'
FROM inserted_sarver_entries
WHERE name_text = 'BROERMAN/SCHARF'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH heintz_batches AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 23
    AND source_page_number = 202
    AND parsed_section_name = 'C'
    AND parsed_row_number = 4
    AND parsed_position_number = 13
    AND name_text = 'HEINTZ'
    AND raw_text LIKE '%SCHUG%'
),
trimmed_heintz AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = 41,
    raw_text = $nhg$HEINTZ (4C, 13, s) pillow, gray granite, exc cond, grapes "Jacob Heinl:2,Jr /·1886-1949" CR: Jacob A., d. October 16, 1949, 63y 28da$nhg$,
    inscription_text = $nhg$Jacob Heinl:2,Jr /·1886-1949$nhg$,
    source_entry = jsonb_build_object('heading', 'HEINTZ (4C, 13, s) pillow, gray granite, exc cond, grapes', 'descriptor', 'pillow, gray granite, exc cond, grapes'),
    updated_at = now()
  FROM heintz_batches
  WHERE entry.id = heintz_batches.id
  RETURNING entry.id, entry.batch_id, heintz_batches.cemetery_id
),
removed_heintz_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING trimmed_heintz
  WHERE fact.entry_id = trimmed_heintz.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
),
inserted_heintz_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Jacob A., d. October 16, 1949, 63y 28da', NULL::date, 'CR: Jacob A., d. October 16, 1949, 63y 28da', 'review'
  FROM trimmed_heintz
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'October 16, 1949', DATE '1949-10-16', 'CR: Jacob A., d. October 16, 1949, 63y 28da', 'high'
  FROM trimmed_heintz
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
),
new_heintz_entries(batch_id, cemetery_id, source_line_start, source_line_end, raw_text, name_text, surnames, parsed_position_number, marker_scope, marker_type, inscription_text, parsed_years, source_heading, source_descriptor) AS (
  SELECT
    heintz_batches.batch_id,
    heintz_batches.cemetery_id,
    reading.source_line_start,
    reading.source_line_end,
    reading.raw_text,
    reading.name_text,
    reading.surnames,
    reading.parsed_position_number,
    reading.marker_scope,
    reading.marker_type,
    reading.inscription_text,
    reading.parsed_years,
    reading.source_heading,
    reading.source_descriptor
  FROM heintz_batches
  JOIN trimmed_heintz ON trimmed_heintz.batch_id = heintz_batches.batch_id
  CROSS JOIN (
    VALUES
      (42, 44, $nhg$SCHUG (4C, 14, c) flat, gray granite, exc cond, crosses "Schug / 1910 Emile J. 1994 / 1912 Hazel M. 1997"$nhg$, 'SCHUG', ARRAY['SCHUG']::text[], 14, 'couple', 'flat', $nhg$Schug / 1910 Emile J. 1994 / 1912 Hazel M. 1997$nhg$, ARRAY[1910, 1912, 1994, 1997]::integer[], 'SCHUG (4C, 14, c) flat, gray granite, exc cond, crosses', 'flat, gray granite, exc cond, crosses'),
      (45, 47, $nhg$ZIEGENTHALER (4C, 15, s) upright, gray granite, exc cond, ivy "Z / George / Ziegenthaler / born / Jan. 7, 1859 / died / May 30, 1902 / At rest"$nhg$, 'ZIEGENTHALER', ARRAY['ZIEGENTHALER']::text[], 15, 'single', 'upright', $nhg$Z / George / Ziegenthaler / born / Jan. 7, 1859 / died / May 30, 1902 / At rest$nhg$, ARRAY[1859, 1902]::integer[], 'ZIEGENTHALER (4C, 15, s) upright, gray granite, exc cond, ivy', 'upright, gray granite, exc cond, ivy')
  ) AS reading(source_line_start, source_line_end, raw_text, name_text, surnames, parsed_position_number, marker_scope, marker_type, inscription_text, parsed_years, source_heading, source_descriptor)
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id, cemetery_id, 23, 202, source_line_start, source_line_end,
  raw_text, name_text, surnames, 'C', 4, parsed_position_number,
  marker_scope, marker_type, 'granite', 'excellent', inscription_text, parsed_years,
  'high', ARRAY[]::text[], jsonb_build_object('heading', source_heading, 'descriptor', source_descriptor)
FROM new_heintz_entries
WHERE NOT EXISTS (
  SELECT 1
  FROM north_hills_ocr_entries existing
  WHERE existing.batch_id = new_heintz_entries.batch_id
    AND existing.source_page_number = 202
    AND existing.parsed_section_name = 'C'
    AND existing.parsed_row_number = 4
    AND existing.parsed_position_number = new_heintz_entries.parsed_position_number
)
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WITTMER (4C, 16, s) pillow, gray granite, exc cond "William J. Wittmer / 1848-1923 / Father" CR: d. September 4, 1923, 78y 3m 15da$nhg$,
  inscription_text = $nhg$William J. Wittmer / 1848-1923 / Father$nhg$,
  updated_at = now()
WHERE source_page_index = 23
  AND source_page_number = 202
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 16
  AND name_text = 'WITTMER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, 'lSda', '15da'),
  raw_text = replace(fact.raw_text, 'lSda', '15da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 23
  AND entry.source_page_number = 202
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 4
  AND entry.parsed_position_number = 16
  AND entry.name_text = 'WITTMER'
  AND fact.source_code = 'CR';

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 23 AND source_page_number = 202 AND parsed_section_name = 'C' AND parsed_row_number = 4 AND parsed_position_number IN (7,8,9,13) AND name_text IN ('SARVER','TAYLOR/SARVER','BROERMAN/SCHARF','HEINTZ')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 23 AND source_page_number = 202 AND parsed_section_name = 'C' AND parsed_row_number = 4 AND parsed_position_number IN (8,9,14,15) AND name_text IN ('TAYLOR/SARVER','BROERMAN/SCHARF','SCHUG','ZIEGENTHALER');
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
