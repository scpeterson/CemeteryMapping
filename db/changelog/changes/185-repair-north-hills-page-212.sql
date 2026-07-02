--liquibase formatted sql

--changeset cemeterymapping:185-repair-north-hills-page-212 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 212
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 4, 'PHILLIPS', ARRAY['PHILLIPS']::text[], 12, 3, 'single', 'pillow', 'granite', 'excellent',
        $nhg$PHILLIPS ( 12C, 3, s) pillow, gray granite, exc cond, cross, flower "Roy A. Phillips/ 1887-1965 / Father"$nhg$,
        $nhg$Roy A. Phillips/ 1887-1965 / Father$nhg$,
        ARRAY[1887, 1965]::integer[],
        ARRAY[]::text[],
        $json${"heading":"PHILLIPS ( 12C, 3, s) pillow, gray granite, exc cond, cross, flower","descriptor":"pillow, gray granite, exc cond, cross, flower"}$json$::jsonb
      ),
      (
        6, 7, 'PHILLIPS', ARRAY['PHILLIPS']::text[], 12, 4, 'single', 'pillow', 'granite', 'excellent',
        $nhg$PHILLIPS (12C, 4, s) pillow, gray granite, exc cond, cross, flowers "Hilda K. Phillips/ 1889-1984 / Mother"$nhg$,
        $nhg$Hilda K. Phillips/ 1889-1984 / Mother$nhg$,
        ARRAY[1889, 1984]::integer[],
        ARRAY[]::text[],
        $json${"heading":"PHILLIPS (12C, 4, s) pillow, gray granite, exc cond, cross, flowers","descriptor":"pillow, gray granite, exc cond, cross, flowers"}$json$::jsonb
      ),
      (
        10, 12, 'WINSLOW/FISKE', ARRAY['WINSLOW','FISKE']::text[], 12, 5, 'single', 'pillow', 'granite', 'excellent',
        $nhg$WINSLOW/FISKE (12C, 5, s) pillow, gray granite, exc cond "Russell Fiske/ Winslow / 1923·1923" CR: d. August 8, 1923, 2m$nhg$,
        $nhg$Russell Fiske/ Winslow / 1923·1923$nhg$,
        ARRAY[1923]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WINSLOW/FISKE (12C, 5, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        33, 35, 'TITLEY', ARRAY['TITLEY']::text[], 13, 1, 'single', 'upright', 'granite', 'excellent',
        $nhg$TITLEY (13C, 1, s) upright, gray granite, exc cond "Father / William E. Titley / 1867-1942"$nhg$,
        $nhg$Father / William E. Titley / 1867-1942$nhg$,
        ARRAY[1867, 1942]::integer[],
        ARRAY[]::text[],
        $json${"heading":"TITLEY (13C, 1, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      )
  ) AS values(source_line_start, source_line_end, name_text, surnames, parsed_row_number, parsed_position_number, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
),
inserted_missing AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    page_batches.batch_id,
    page_batches.cemetery_id,
    page_batches.source_page_index,
    212,
    entry_values.source_line_start,
    entry_values.source_line_end,
    entry_values.raw_text,
    entry_values.name_text,
    entry_values.surnames,
    'C',
    entry_values.parsed_row_number,
    entry_values.parsed_position_number,
    entry_values.parsed_marker_scope,
    entry_values.marker_type_text,
    entry_values.material_text,
    entry_values.condition_text,
    entry_values.inscription_text,
    entry_values.parsed_years,
    'high',
    entry_values.parse_notes,
    entry_values.source_entry
  FROM page_batches
  CROSS JOIN entry_values
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = page_batches.source_page_index
      AND existing.source_page_number = 212
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = entry_values.parsed_row_number
      AND existing.parsed_position_number = entry_values.parsed_position_number
      AND existing.name_text = entry_values.name_text
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_missing;

WITH updated_entries AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = corrections.source_line_end,
    raw_text = corrections.raw_text,
    name_text = corrections.name_text,
    surnames = corrections.surnames,
    parsed_section_name = 'C',
    parsed_row_number = corrections.parsed_row_number,
    parsed_position_number = corrections.parsed_position_number,
    parsed_marker_scope = corrections.parsed_marker_scope,
    marker_type_text = corrections.marker_type_text,
    material_text = corrections.material_text,
    condition_text = corrections.condition_text,
    inscription_text = corrections.inscription_text,
    parsed_years = corrections.parsed_years,
    parse_confidence = 'high',
    parse_notes = corrections.parse_notes,
    source_entry = corrections.source_entry,
    updated_at = now()
  FROM (
    VALUES
      (
        12, 3, 4, 'PHILLIPS', ARRAY['PHILLIPS']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$PHILLIPS ( 12C, 3, s) pillow, gray granite, exc cond, cross, flower "Roy A. Phillips/ 1887-1965 / Father"$nhg$,
        $nhg$Roy A. Phillips/ 1887-1965 / Father$nhg$,
        ARRAY[1887, 1965]::integer[],
        ARRAY[]::text[],
        $json${"heading":"PHILLIPS ( 12C, 3, s) pillow, gray granite, exc cond, cross, flower","descriptor":"pillow, gray granite, exc cond, cross, flower"}$json$::jsonb
      ),
      (
        12, 6, 15, 'JOHNSTON/WINSLOW', ARRAY['JOHNSTON','WINSLOW']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$JOHNSTON/WINSLOW (12C, 6, s) pillow, gray granite, exc cond "Ethel F. Winslow/ Johnston / 1902-1967"$nhg$,
        $nhg$Ethel F. Winslow/ Johnston / 1902-1967$nhg$,
        ARRAY[1902, 1967]::integer[],
        ARRAY[]::text[],
        $json${"heading":"JOHNSTON/WINSLOW (12C, 6, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        12, 7, 22, 'KNOBELOCH', ARRAY['KNOBELOCH']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$KNOBELOCH (12C, 7, c) upright, pink granite, exc cond, flowers, leaves "Knobeloch / Howard W. / 1914-1972 / Father / June O. / 1920-1992 / Mother/ Together forever"$nhg$,
        $nhg$Knobeloch / Howard W. / 1914-1972 / Father / June O. / 1920-1992 / Mother/ Together forever$nhg$,
        ARRAY[1914, 1920, 1972, 1992]::integer[],
        ARRAY['2 bronze vases in front of stone.']::text[],
        $json${"heading":"KNOBELOCH (12C, 7, c) upright, pink granite, exc cond, flowers, leaves","descriptor":"upright, pink granite, exc cond, flowers, leaves"}$json$::jsonb
      ),
      (
        12, 8, 29, 'KNOBELOCH', ARRAY['KNOBELOCH']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$KNOBELOCH (12C, 8, s) upright, pink granite, exc cond, flowers, leaves "Knobeloch / Judith A. / Knobeloch / 1940-2004 / Vietnam Army" Right side of stone is blank. Separate flag holder: "Vietnam / US/ 1964-1975", star CR: d. March 7, 2004$nhg$,
        $nhg$Knobeloch / Judith A. / Knobeloch / 1940-2004 / Vietnam Army Vietnam / US/ 1964-1975$nhg$,
        ARRAY[1940, 1964, 1975, 2004]::integer[],
        ARRAY['About 60 feet to end of row.']::text[],
        $json${"heading":"KNOBELOCH (12C, 8, s) upright, pink granite, exc cond, flowers, leaves","descriptor":"upright, pink granite, exc cond, flowers, leaves"}$json$::jsonb
      ),
      (
        13, 3, 43, 'SCHAEFER', ARRAY['SCHAEFER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$SCHAEFER (13C, 3, s) upright, gray granite, exc cond, tulips, leaves "Blanche S. Schaefer / May 4, 1906 / March 3, 1995" On back: "Schaefer" Bronze vase in front of stone$nhg$,
        $nhg$Blanche S. Schaefer / May 4, 1906 / March 3, 1995 Schaefer$nhg$,
        ARRAY[1906, 1995]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHAEFER (13C, 3, s) upright, gray granite, exc cond, tulips, leaves","descriptor":"upright, gray granite, exc cond, tulips, leaves"}$json$::jsonb
      ),
      (
        13, 4, 46, 'CAIRNS', ARRAY['CAIRNS']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$CAIRNS (13C, 4, s) pillow, gray granite, exc cond "Lewis B. Cairns / 1877-1944 / Father" CR: d. February 17, 1944$nhg$,
        $nhg$Lewis B. Cairns / 1877-1944 / Father$nhg$,
        ARRAY[1877, 1944]::integer[],
        ARRAY[]::text[],
        $json${"heading":"CAIRNS (13C, 4, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        13, 5, 50, 'CAIRNS', ARRAY['CAIRNS']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$CAIRNS (13C, 5, s) pillow, gray granite, exc cond "Catherine A. Cairns/ 1881-1940 / Mother" CR: Mrs. Lewis Cairns, d, November 3, 1941$nhg$,
        $nhg$Catherine A. Cairns/ 1881-1940 / Mother$nhg$,
        ARRAY[1881, 1940, 1941]::integer[],
        ARRAY[]::text[],
        $json${"heading":"CAIRNS (13C, 5, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 212
    AND entry.parsed_section_name = 'C'
    AND entry.parsed_row_number = corrections.parsed_row_number
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING updated_entries
  WHERE fact.entry_id = updated_entries.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

WITH source_entries AS (
  SELECT id, batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 212
    AND parsed_section_name = 'C'
    AND parsed_row_number = 13
    AND parsed_position_number = 2
    AND name_text = 'SCHAEFER'
),
inserted AS (
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
    212,
    41,
    43,
    $nhg$SCHAEFER (13C, 3, s) upright, gray granite, exc cond, tulips, leaves "Blanche S. Schaefer / May 4, 1906 / March 3, 1995" On back: "Schaefer" Bronze vase in front of stone$nhg$,
    'SCHAEFER',
    ARRAY['SCHAEFER']::text[],
    'C',
    13,
    3,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Blanche S. Schaefer / May 4, 1906 / March 3, 1995 Schaefer$nhg$,
    ARRAY[1906, 1995]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"SCHAEFER (13C, 3, s) upright, gray granite, exc cond, tulips, leaves","descriptor":"upright, gray granite, exc cond, tulips, leaves"}$json$::jsonb
  FROM source_entries
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = source_entries.batch_id
      AND existing.source_page_index = source_entries.source_page_index
      AND existing.source_page_number = 212
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 13
      AND existing.parsed_position_number = 3
      AND existing.name_text = 'SCHAEFER'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted;

WITH affected_entries AS (
  SELECT id, parsed_row_number, parsed_position_number
  FROM north_hills_ocr_entries
  WHERE source_page_number = 212
    AND parsed_section_name = 'C'
    AND (
      (parsed_row_number = 12 AND parsed_position_number IN (5, 8))
      OR (parsed_row_number = 13 AND parsed_position_number IN (4, 5))
    )
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. August 8, 1923, 2m', NULL::date, 'CR: d. August 8, 1923, 2m', 'review'
FROM affected_entries WHERE parsed_row_number = 12 AND parsed_position_number = 5
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 8, 1923', DATE '1923-08-08', 'CR: d. August 8, 1923, 2m', 'high'
FROM affected_entries WHERE parsed_row_number = 12 AND parsed_position_number = 5
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '2m', NULL::date, 'CR: d. August 8, 1923, 2m', 'medium'
FROM affected_entries WHERE parsed_row_number = 12 AND parsed_position_number = 5
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. March 7, 2004', NULL::date, 'CR: d. March 7, 2004', 'review'
FROM affected_entries WHERE parsed_row_number = 12 AND parsed_position_number = 8
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'March 7, 2004', DATE '2004-03-07', 'CR: d. March 7, 2004', 'high'
FROM affected_entries WHERE parsed_row_number = 12 AND parsed_position_number = 8
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. February 17, 1944', NULL::date, 'CR: d. February 17, 1944', 'review'
FROM affected_entries WHERE parsed_row_number = 13 AND parsed_position_number = 4
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'February 17, 1944', DATE '1944-02-17', 'CR: d. February 17, 1944', 'high'
FROM affected_entries WHERE parsed_row_number = 13 AND parsed_position_number = 4
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Mrs. Lewis Cairns, d, November 3, 1941', NULL::date, 'CR: Mrs. Lewis Cairns, d, November 3, 1941', 'review'
FROM affected_entries WHERE parsed_row_number = 13 AND parsed_position_number = 5
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 212 AND parsed_section_name = 'C' AND ((parsed_row_number = 12 AND parsed_position_number IN (5, 8)) OR (parsed_row_number = 13 AND parsed_position_number IN (4, 5)))) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 212 AND parsed_section_name = 'C' AND ((parsed_row_number = 12 AND parsed_position_number IN (4, 5)) OR (parsed_row_number = 13 AND parsed_position_number IN (1, 3)));
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
