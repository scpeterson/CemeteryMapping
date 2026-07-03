--liquibase formatted sql

--changeset cemeterymapping:190-repair-north-hills-page-215 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 215
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (3, 5, 'CRERAR', ARRAY['CRERAR']::text[], 14, 8, 'single', 'upright', 'granite', 'excellent',
        $nhg$CRERAR (14C, 8, s) upright, gray granite, exc cond, flowers "James Crerar / May 6, 1905 / Jan. 19, 1954 / Father" CR: d. January 19, 1954, 48y 8m 13da$nhg$,
        $nhg$James Crerar / May 6, 1905 / Jan. 19, 1954 / Father$nhg$,
        ARRAY[1905, 1954]::integer[],
        ARRAY[]::text[],
        $json${"heading":"CRERAR (14C, 8, s) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (21, 23, 'ROBERTSON', ARRAY['ROBERTSON']::text[], 15, 2, 'single', 'flat', 'bronze', 'excellent',
        $nhg$ROBERTSON (15C, 2, s) flat, bronze, exc cond, cross "Helen W Robertson / Beloved wife / Sep 9 1899 Nov 10 1992"$nhg$,
        $nhg$Helen W Robertson / Beloved wife / Sep 9 1899 Nov 10 1992$nhg$,
        ARRAY[1899, 1992]::integer[],
        ARRAY[]::text[],
        $json${"heading":"ROBERTSON (15C, 2, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (29, 31, 'HOERR/ BERDURG(?)', ARRAY['HOERR','BERDURG']::text[], 15, 4, 'single', 'upright', 'granite', 'excellent',
        $nhg$HOERR/ BERDURG(?) (15C, 4, s) upright, red granite, exc cond, archway, flowers, leaves "Mother/ Wilhelmine A. Hoerr / Oct. 16, 1869 / July 3, 1944" CR: Wilhelmine Berdurg(?) Hoerr$nhg$,
        $nhg$Mother/ Wilhelmine A. Hoerr / Oct. 16, 1869 / July 3, 1944$nhg$,
        ARRAY[1869, 1944]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HOERR/ BERDURG(?) (15C, 4, s) upright, red granite, exc cond, archway, flowers, leaves","descriptor":"upright, red granite, exc cond, archway, flowers, leaves"}$json$::jsonb
      ),
      (33, 34, 'HOERR', ARRAY['HOERR']::text[], 15, 5, 'single', 'flat', 'bronze', 'excellent',
        $nhg$HOERR (15C, 5, s) flat, bronze, exc cond, cross "William H. Hoerr / June 18 1902 - Oct 8 1984" Separate flag holder: "US / Veteran", star$nhg$,
        $nhg$William H. Hoerr / June 18 1902 - Oct 8 1984 US / Veteran$nhg$,
        ARRAY[1902, 1984]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HOERR (15C, 5, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (36, 37, 'DODSON', ARRAY['DODSON']::text[], 15, 6, 'single', 'flat', 'granite', 'excellent',
        $nhg$DODSON (15C, 6, s) flat, red granite, exc cond "In loving memory / Paul G. Dodson / 1914-1992"$nhg$,
        $nhg$In loving memory / Paul G. Dodson / 1914-1992$nhg$,
        ARRAY[1914, 1992]::integer[],
        ARRAY[]::text[],
        $json${"heading":"DODSON (15C, 6, s) flat, red granite, exc cond","descriptor":"flat, red granite, exc cond"}$json$::jsonb
      ),
      (43, 46, 'GILES', ARRAY['GILES']::text[], 15, 8, 'single', 'pillow', 'granite', 'excellent',
        $nhg$GILES (15C, 8, s) pillow, red granite, exc cond 'Tornelia Giles/ 1900- 1953"$nhg$,
        $nhg$Tornelia Giles/ 1900- 1953$nhg$,
        ARRAY[1900, 1953]::integer[],
        ARRAY['Plot marker, gray granite "W".']::text[],
        $json${"heading":"GILES (15C, 8, s) pillow, red granite, exc cond","descriptor":"pillow, red granite, exc cond"}$json$::jsonb
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
    215,
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
      AND existing.source_page_number = 215
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
        14, 10, 15, 'BRANT/SARVER', ARRAY['BRANT','SARVER']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRANT/SARVER (14C, 10, c) upright, gray granite, exc cond, flowers "Brant / Elmer H. / 1914-1977 / Eleanor S. / 1918-1947'' CR: Elmer, d. October 18, 1977, 63y 3m 5da. Mrs. Eleanor Sarver Brant, d. January 25, 1947, 28y 2m 28da$nhg$,
        $nhg$Brant / Elmer H. / 1914-1977 / Eleanor S. / 1918-1947$nhg$,
        ARRAY[1914, 1918, 1947, 1977]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT/SARVER (14C, 10, c) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (
        15, 1, 20, 'ROBERTSON', ARRAY['ROBERTSON']::text[], 'single', 'flat', 'bronze', 'excellent',
        $nhg$ROBERTSON (15C, 1, s) flat, bronze, exc cond, cross "Albert E Robertson / US Army / World War I / July 29 1895 Jul 17 1985" Separate flag holder: "US / Veteran", star$nhg$,
        $nhg$Albert E Robertson / US Army / World War I / July 29 1895 Jul 17 1985 US / Veteran$nhg$,
        ARRAY[1895, 1985]::integer[],
        ARRAY[]::text[],
        $json${"heading":"ROBERTSON (15C, 1, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (
        15, 3, 28, 'HOERR', ARRAY['HOERR']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$HOERR (15C, 3, s) upright, red granite, exc cond, flowers, leaves "Daughter / Margaret M. Hoerr / May 31, 1904 / Sept. 17, 1942"$nhg$,
        $nhg$Daughter / Margaret M. Hoerr / May 31, 1904 / Sept. 17, 1942$nhg$,
        ARRAY[1904, 1942]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HOERR (15C, 3, s) upright, red granite, exc cond, flowers, leaves","descriptor":"upright, red granite, exc cond, flowers, leaves"}$json$::jsonb
      ),
      (
        15, 7, 42, 'KOHLER', ARRAY['KOHLER']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$KOHLER (15C, 7, c) upright, red granite, exc cond, 7 foot stele., flowers, leaves, "Kohler" On base "Edmund / 1894-1971 / Marie / 1894-1973"$nhg$,
        $nhg$Kohler Edmund / 1894-1971 / Marie / 1894-1973$nhg$,
        ARRAY[1894, 1971, 1973]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KOHLER (15C, 7, c) upright, red granite, exc cond, 7 foot stele., flowers, leaves","descriptor":"upright, red granite, exc cond, 7 foot stele., flowers, leaves"}$json$::jsonb
      ),
      (
        15, 9, 49, 'SCHARF', ARRAY['SCHARF']::text[], 'single', 'flat', 'bronze', 'excellent',
        $nhg$SCHARF (15C, 9, s) flat, bronze, exc cond, ivy "John P. Scharf / Aug. 27, 1894 / Nov. 29, 1964" CR: Middle name Peter$nhg$,
        $nhg$John P. Scharf / Aug. 27, 1894 / Nov. 29, 1964$nhg$,
        ARRAY[1894, 1964]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHARF (15C, 9, s) flat, bronze, exc cond, ivy","descriptor":"flat, bronze, exc cond, ivy"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 215
    AND entry.parsed_section_name = 'C'
    AND entry.parsed_row_number = corrections.parsed_row_number
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
),
affected_entries AS (
  SELECT id
  FROM updated_entries
  UNION
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 215
    AND parsed_section_name = 'C'
    AND (
      (parsed_row_number = 14 AND parsed_position_number IN (8, 10))
      OR (parsed_row_number = 15 AND parsed_position_number IN (4, 9))
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (14, 8, 'CR', 'Church Records', 'death_date', 'January 19, 1954', DATE '1954-01-19', 'CR: d. January 19, 1954, 48y 8m 13da', 'high'),
    (14, 8, 'CR', 'Church Records', 'note', 'd. January 19, 1954, 48y 8m 13da', NULL::date, 'CR: d. January 19, 1954, 48y 8m 13da', 'review'),
    (14, 10, 'CR', 'Church Records', 'death_date', 'October 18, 1977', DATE '1977-10-18', 'CR: Elmer, d. October 18, 1977, 63y 3m 5da. Mrs. Eleanor Sarver Brant, d. January 25, 1947, 28y 2m 28da', 'high'),
    (14, 10, 'CR', 'Church Records', 'death_date', 'January 25, 1947', DATE '1947-01-25', 'CR: Elmer, d. October 18, 1977, 63y 3m 5da. Mrs. Eleanor Sarver Brant, d. January 25, 1947, 28y 2m 28da', 'high'),
    (14, 10, 'CR', 'Church Records', 'note', 'Elmer, d. October 18, 1977, 63y 3m 5da. Mrs. Eleanor Sarver Brant, d. January 25, 1947, 28y 2m 28da', NULL::date, 'CR: Elmer, d. October 18, 1977, 63y 3m 5da. Mrs. Eleanor Sarver Brant, d. January 25, 1947, 28y 2m 28da', 'review'),
    (15, 4, 'CR', 'Church Records', 'note', 'Wilhelmine Berdurg(?) Hoerr', NULL::date, 'CR: Wilhelmine Berdurg(?) Hoerr', 'review'),
    (15, 9, 'CR', 'Church Records', 'note', 'Middle name Peter', NULL::date, 'CR: Middle name Peter', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 215
  AND entry.parsed_section_name = 'C'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 215 AND parsed_section_name = 'C' AND ((parsed_row_number = 14 AND parsed_position_number IN (8, 10)) OR (parsed_row_number = 15 AND parsed_position_number IN (1, 2, 3, 4, 5, 6, 7, 8, 9)))) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 215 AND parsed_section_name = 'C' AND ((parsed_row_number = 14 AND parsed_position_number = 8) OR (parsed_row_number = 15 AND parsed_position_number IN (2, 4, 5, 6, 8)));
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
