--liquibase formatted sql

--changeset cemeterymapping:183-repair-north-hills-page-210 splitStatements:false
WITH updated_entries AS (
  UPDATE north_hills_ocr_entries entry
  SET
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
        10, 4, 'ALT', ARRAY['ALT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$ALT (10C, 4,s) upright, gray granite, exc cond, flower, leaves "Mother / Kate Alt / 1870-1940"$nhg$,
        $nhg$Mother / Kate Alt / 1870-1940$nhg$,
        ARRAY[1870, 1940]::integer[],
        ARRAY['A white stone rabbit with brown stone eyes was observed on top of stone at first reading. It was beside the stone on a second reading.']::text[],
        $json${"heading":"ALT (10C, 4,s) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        10, 5, 'ALT', ARRAY['ALT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$ALT (10C, 5, s) upright, gray granite, exc cond "Father / Charles H. Alt / 1898-1956"$nhg$,
        $nhg$Father / Charles H. Alt / 1898-1956$nhg$,
        ARRAY[1898, 1956]::integer[],
        ARRAY[]::text[],
        $json${"heading":"ALT (10C, 5, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        10, 6, 'SCHMIDT', ARRAY['SCHMIDT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$SCHMIDT (10C, 6, c) upright, gray granite, exc cond, 2 crosses "Schmidt / Elmer G. / 1899-1977 / Husband / Magdeline P. / 1903-1989 / Wife" CR: Magdeline, May 18, 2003 - Oct. 7, 1989$nhg$,
        $nhg$Schmidt / Elmer G. / 1899-1977 / Husband / Magdeline P. / 1903-1989 / Wife$nhg$,
        ARRAY[1899, 1903, 1977, 1989, 2003]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHMIDT (10C, 6, c) upright, gray granite, exc cond, 2 crosses","descriptor":"upright, gray granite, exc cond, 2 crosses"}$json$::jsonb
      ),
      (
        11, 1, 'WAGNER/SCHAEFER', ARRAY['WAGNER','SCHAEFER']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$WAGNER/SCHAEFER (11C, 1, c) upright, gray, granite, exc cond, flowers, leaves "Wagner / Anthony / Sept. 17, 1891 / Sept. 22, 1989 / Helen Schaefer / Dec. 17, 1900/Jan.28, 1992 / I said goodbye" On back: "Wagner"$nhg$,
        $nhg$Wagner / Anthony / Sept. 17, 1891 / Sept. 22, 1989 / Helen Schaefer / Dec. 17, 1900/Jan.28, 1992 / I said goodbye Wagner$nhg$,
        ARRAY[1891, 1900, 1989, 1992]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WAGNER/SCHAEFER (11C, 1, c) upright, gray, granite, exc cond, flowers, leaves","descriptor":"upright, gray, granite, exc cond, flowers, leaves"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 210
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

WITH schmidt_entries AS (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 210
    AND parsed_section_name = 'C'
    AND parsed_row_number = 10
    AND parsed_position_number = 6
    AND name_text = 'SCHMIDT'
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Magdeline, May 18, 2003 - Oct. 7, 1989', NULL::date, 'CR: Magdeline, May 18, 2003 - Oct. 7, 1989', 'review'
FROM schmidt_entries
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 210
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        24, 25, 'CLABAUGH', ARRAY['CLABAUGH']::text[], 11, 2, 'single', 'flat', 'granite', 'excellent',
        $nhg$CLABAUGH (11C, 2, s) flat, gray granite, exc cond, cross, flower "Laura Louise / Clabaugh/ 1930-1989 / Daughter"$nhg$,
        $nhg$Laura Louise / Clabaugh/ 1930-1989 / Daughter$nhg$,
        ARRAY[1930, 1989]::integer[],
        ARRAY[]::text[],
        $json${"heading":"CLABAUGH (11C, 2, s) flat, gray granite, exc cond, cross, flower","descriptor":"flat, gray granite, exc cond, cross, flower"}$json$::jsonb
      ),
      (
        27, 28, 'SCHAEFER', ARRAY['SCHAEFER']::text[], 11, 3, 'single', 'pillow', 'granite', 'excellent',
        $nhg$SCHAEFER (11C, 3, s) pillow, gray granite, exc cond, flowers "Father / Charles H. Schaefer / 1874-1957"$nhg$,
        $nhg$Father / Charles H. Schaefer / 1874-1957$nhg$,
        ARRAY[1874, 1957]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHAEFER (11C, 3, s) pillow, gray granite, exc cond, flowers","descriptor":"pillow, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (
        29, 31, 'SCHAEFER', ARRAY['SCHAEFER']::text[], 11, 4, 'single', 'pillow', 'granite', 'excellent',
        $nhg$SCHAEFER (11C, 4, s) pillow, gray granite, exc cond, flowers "Mother / Louisa A. Schaefer / 1878-1964"$nhg$,
        $nhg$Mother / Louisa A. Schaefer / 1878-1964$nhg$,
        ARRAY[1878, 1964]::integer[],
        ARRAY['Gap, about 12 feet.']::text[],
        $json${"heading":"SCHAEFER (11C, 4, s) pillow, gray granite, exc cond, flowers","descriptor":"pillow, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (
        33, 36, 'KING', ARRAY['KING']::text[], 11, 5, 'couple', 'upright', 'granite', 'excellent',
        $nhg$KING (11C, 5, c) upright, gray granite, exc cond "King / William F. King / 1856-1931 / Elizabeth, His Wife/ 1860-1950 / Lorena, 1881- 1924 / Coretta, 1888-1961 / Anna, 1884-1971"$nhg$,
        $nhg$King / William F. King / 1856-1931 / Elizabeth, His Wife/ 1860-1950 / Lorena, 1881- 1924 / Coretta, 1888-1961 / Anna, 1884-1971$nhg$,
        ARRAY[1856, 1860, 1881, 1884, 1888, 1924, 1931, 1950, 1961, 1971]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KING (11C, 5, c) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        38, 40, 'WATENPOOL/BEHLER/WATTENPOOL', ARRAY['WATENPOOL','BEHLER','WATTENPOOL']::text[], 11, 6, 'single', 'flat', 'bronze', 'excellent',
        $nhg$WATENPOOL/BEHLER/WATTENPOOL (11C, 6, s) flat, bronze, exc cond, cross "Hazel G. Watenpool / 1891-1923" CR: Hazel Behler Wattenpool, d. April 2, 1923, 31y 7m 27da$nhg$,
        $nhg$Hazel G. Watenpool / 1891-1923$nhg$,
        ARRAY[1891, 1923]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WATENPOOL/BEHLER/WATTENPOOL (11C, 6, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (
        42, 44, 'WATENPOOL/STEELE', ARRAY['WATENPOOL','STEELE']::text[], 11, 7, 'single', 'pillow', 'granite', 'excellent',
        $nhg$WATENPOOL/STEELE (11C, 7, s) pillow, gray granite, exc cond, flowers, leaves "'Mom'/ Velma Ann/ Watenpool / Aug. 28, 1914 / July 17, 1983" CR: George Steele's sister$nhg$,
        $nhg$'Mom'/ Velma Ann/ Watenpool / Aug. 28, 1914 / July 17, 1983$nhg$,
        ARRAY[1914, 1983]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WATENPOOL/STEELE (11C, 7, s) pillow, gray granite, exc cond, flowers, leaves","descriptor":"pillow, gray granite, exc cond, flowers, leaves"}$json$::jsonb
      )
  ) AS values(source_line_start, source_line_end, name_text, surnames, parsed_row_number, parsed_position_number, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
),
inserted AS (
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
    210,
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
      AND existing.source_page_number = 210
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = entry_values.parsed_row_number
      AND existing.parsed_position_number = entry_values.parsed_position_number
      AND existing.name_text = entry_values.name_text
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id, name_text
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Hazel Behler Wattenpool, d. April 2, 1923, 31y 7m 27da', NULL::date, 'CR: Hazel Behler Wattenpool, d. April 2, 1923, 31y 7m 27da', 'review'
FROM inserted WHERE name_text = 'WATENPOOL/BEHLER/WATTENPOOL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'April 2, 1923', DATE '1923-04-02', 'CR: Hazel Behler Wattenpool, d. April 2, 1923, 31y 7m 27da', 'high'
FROM inserted WHERE name_text = 'WATENPOOL/BEHLER/WATTENPOOL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '31y 7m 27d', NULL::date, 'CR: Hazel Behler Wattenpool, d. April 2, 1923, 31y 7m 27da', 'medium'
FROM inserted WHERE name_text = 'WATENPOOL/BEHLER/WATTENPOOL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'George Steele''s sister', NULL::date, 'CR: George Steele''s sister', 'review'
FROM inserted WHERE name_text = 'WATENPOOL/STEELE'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 210 AND parsed_section_name = 'C' AND parsed_row_number IN (10, 11)) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 210 AND parsed_section_name = 'C' AND parsed_row_number = 11 AND parsed_position_number IN (2, 3, 4, 5, 6, 7);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
