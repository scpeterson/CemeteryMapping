--liquibase formatted sql

--changeset cemeterymapping:192-repair-north-hills-page-216 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 216
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 5, 'MCKEE/SCHARF', ARRAY['MCKEE','SCHARF']::text[], 15, 10, 'single', 'upright', 'granite', 'excellent',
        $nhg$MCKEE/SCHARF (15C, 10, s) upright, gray granite, exc cond, flower, leaves "Margaret Scharf / McKee/ 1884-1953" CR: Anna Margaret, d, February 11, 1953, 68y 4m 15da$nhg$,
        $nhg$Margaret Scharf / McKee/ 1884-1953$nhg$,
        ARRAY[1884, 1953]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MCKEE/SCHARF (15C, 10, s) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        40, 43, 'UHLENBURG/ULEMBERG', ARRAY['UHLENBURG','ULEMBERG']::text[], 15, 18, 'single', 'upright', 'granite', 'excellent',
        $nhg$UHLENBURG/ULEMBERG (15C, 18, s) upright, gray granite, exc cond, flower "Wife / Christine Uhlenburg / 1873-1955" CR: Christina F Ulemberg., d. October 14, 1955. Funeral conducted by Rev. Martin, member of Salem Methodist$nhg$,
        $nhg$Wife / Christine Uhlenburg / 1873-1955$nhg$,
        ARRAY[1873, 1955]::integer[],
        ARRAY[]::text[],
        $json${"heading":"UHLENBURG/ULEMBERG (15C, 18, s) upright, gray granite, exc cond, flower","descriptor":"upright, gray granite, exc cond, flower"}$json$::jsonb
      ),
      (
        45, 46, 'HIEBER', ARRAY['HIEBER']::text[], 15, 19, 'couple', 'upright', 'granite', 'excellent',
        $nhg$HIEBER (15C, 19, c) upright, gray granite, exc cond, flowers, leaves "Hieber / Albert D. / 1872-1947 / Ida C. / 1872-[blank] / Wife"$nhg$,
        $nhg$Hieber / Albert D. / 1872-1947 / Ida C. / 1872-[blank] / Wife$nhg$,
        ARRAY[1872, 1947]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HIEBER (15C, 19, c) upright, gray granite, exc cond, flowers, leaves","descriptor":"upright, gray granite, exc cond, flowers, leaves"}$json$::jsonb
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
    216,
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
      AND existing.source_page_number = 216
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
        15, 10, 5, 'MCKEE/SCHARF', ARRAY['MCKEE','SCHARF']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$MCKEE/SCHARF (15C, 10, s) upright, gray granite, exc cond, flower, leaves "Margaret Scharf / McKee/ 1884-1953" CR: Anna Margaret, d, February 11, 1953, 68y 4m 15da$nhg$,
        $nhg$Margaret Scharf / McKee/ 1884-1953$nhg$,
        ARRAY[1884, 1953]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MCKEE/SCHARF (15C, 10, s) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        15, 11, 11, 'GRAU/SCHARF', ARRAY['GRAU','SCHARF']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$GRAU/SCHARF (15C, 11, s) upright, gray granite, exc cond, flower, leaves "Christina E. Grau / nee Scharf / 1887-1938" CR: Christine, d. December 28, 1938$nhg$,
        $nhg$Christina E. Grau / nee Scharf / 1887-1938$nhg$,
        ARRAY[1887, 1938]::integer[],
        ARRAY['Plot marker, gray, no initial.']::text[],
        $json${"heading":"GRAU/SCHARF (15C, 11, s) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        15, 12, 14, 'HAYS', ARRAY['HAYS']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$HAYS (15C, 12, s) pillow, gray granite, exc cond, jonquil, leaves "Father / Henry R. Hays / 1898-1953"$nhg$,
        $nhg$Father / Henry R. Hays / 1898-1953$nhg$,
        ARRAY[1898, 1953]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HAYS (15C, 12, s) pillow, gray granite, exc cond, jonquil, leaves","descriptor":"pillow, gray granite, exc cond, jonquil, leaves"}$json$::jsonb
      ),
      (
        15, 14, 22, 'PROIE', ARRAY['PROIE']::text[], 'couple', 'pillow', 'granite', 'excellent',
        $nhg$PROIE (15C, 14, c) pillow, gray granite, exc cond, lilies, leaves, eternal flame holder "Proie / James A., Jr. / Nov. 17, 1931 / April 9, 2006 / Evelyn C. / April 25, 1932 / April 8, 2000" CR: James, d. April 9, 2006, f. April 12, 2006$nhg$,
        $nhg$Proie / James A., Jr. / Nov. 17, 1931 / April 9, 2006 / Evelyn C. / April 25, 1932 / April 8, 2000$nhg$,
        ARRAY[1931, 1932, 2000, 2006]::integer[],
        ARRAY[]::text[],
        $json${"heading":"PROIE (15C, 14, c) pillow, gray granite, exc cond, lilies, leaves, eternal flame holder","descriptor":"pillow, gray granite, exc cond, lilies, leaves, eternal flame holder"}$json$::jsonb
      ),
      (
        15, 16, 33, 'ULLOM', ARRAY['ULLOM']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$ULLOM (15C, 16, s) pillow, gray granite, exc cond "Rufus K. Ullom / Sgt Co D 111th Inf / enlisted / June 22, 1916 / born Mar. 4, 1877 / discharged / May 14, 1919 / died Sept. 29, 1942" Separate flag holder: "US / Veteran", star CR: buried October 1, 1942, 78y$nhg$,
        $nhg$Rufus K. Ullom / Sgt Co D 111th Inf / enlisted / June 22, 1916 / born Mar. 4, 1877 / discharged / May 14, 1919 / died Sept. 29, 1942 US / Veteran$nhg$,
        ARRAY[1877, 1916, 1919, 1942]::integer[],
        ARRAY[]::text[],
        $json${"heading":"ULLOM (15C, 16, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        15, 17, 38, 'UHLENBURG', ARRAY['UHLENBURG']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$UHLENBURG (15C, 17, s) upright, gray granite, exc cond, flower "Husband / Elmer E. Uhlenburg / 1869-1942"$nhg$,
        $nhg$Husband / Elmer E. Uhlenburg / 1869-1942$nhg$,
        ARRAY[1869, 1942]::integer[],
        ARRAY[]::text[],
        $json${"heading":"UHLENBURG (15C, 17, s) upright, gray granite, exc cond, flower","descriptor":"upright, gray granite, exc cond, flower"}$json$::jsonb
      ),
      (
        15, 18, 43, 'UHLENBURG/ULEMBERG', ARRAY['UHLENBURG','ULEMBERG']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$UHLENBURG/ULEMBERG (15C, 18, s) upright, gray granite, exc cond, flower "Wife / Christine Uhlenburg / 1873-1955" CR: Christina F Ulemberg., d. October 14, 1955. Funeral conducted by Rev. Martin, member of Salem Methodist$nhg$,
        $nhg$Wife / Christine Uhlenburg / 1873-1955$nhg$,
        ARRAY[1873, 1955]::integer[],
        ARRAY[]::text[],
        $json${"heading":"UHLENBURG/ULEMBERG (15C, 18, s) upright, gray granite, exc cond, flower","descriptor":"upright, gray granite, exc cond, flower"}$json$::jsonb
      ),
      (
        15, 19, 46, 'HIEBER', ARRAY['HIEBER']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$HIEBER (15C, 19, c) upright, gray granite, exc cond, flowers, leaves "Hieber / Albert D. / 1872-1947 / Ida C. / 1872-[blank] / Wife"$nhg$,
        $nhg$Hieber / Albert D. / 1872-1947 / Ida C. / 1872-[blank] / Wife$nhg$,
        ARRAY[1872, 1947]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HIEBER (15C, 19, c) upright, gray granite, exc cond, flowers, leaves","descriptor":"upright, gray granite, exc cond, flowers, leaves"}$json$::jsonb
      ),
      (
        15, 20, 51, 'SANDROCK', ARRAY['SANDROCK']::text[], 'couple', 'flat', 'bronze', 'excellent',
        $nhg$SANDROCK (15C, 20, c) flat, bronze, exc cond, roses, leaves, Masonic ' insignia "Adam / 1900 - [blank] / Clara B. / 1906-1978 / Sandrock" Bronze vase. CR: Adam, d. January 30, 1983. Clara E., d. November 3, 1978, 72y 8m 7da$nhg$,
        $nhg$Adam / 1900 - [blank] / Clara B. / 1906-1978 / Sandrock Bronze vase$nhg$,
        ARRAY[1900, 1906, 1978, 1983]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SANDROCK (15C, 20, c) flat, bronze, exc cond, roses, leaves, Masonic ' insignia","descriptor":"flat, bronze, exc cond, roses, leaves, Masonic ' insignia"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 216
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
  WHERE source_page_number = 216
    AND parsed_section_name = 'C'
    AND parsed_row_number = 15
    AND parsed_position_number IN (10, 11, 14, 16, 18, 20)
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
    (15, 10, 'CR', 'Church Records', 'death_date', 'February 11, 1953', DATE '1953-02-11', 'CR: Anna Margaret, d, February 11, 1953, 68y 4m 15da', 'high'),
    (15, 10, 'CR', 'Church Records', 'note', 'Anna Margaret, d, February 11, 1953, 68y 4m 15da', NULL::date, 'CR: Anna Margaret, d, February 11, 1953, 68y 4m 15da', 'review'),
    (15, 11, 'CR', 'Church Records', 'death_date', 'December 28, 1938', DATE '1938-12-28', 'CR: Christine, d. December 28, 1938', 'high'),
    (15, 11, 'CR', 'Church Records', 'note', 'Christine, d. December 28, 1938', NULL::date, 'CR: Christine, d. December 28, 1938', 'review'),
    (15, 14, 'CR', 'Church Records', 'death_date', 'April 9, 2006', DATE '2006-04-09', 'CR: James, d. April 9, 2006, f. April 12, 2006', 'high'),
    (15, 14, 'CR', 'Church Records', 'note', 'James, d. April 9, 2006, f. April 12, 2006', NULL::date, 'CR: James, d. April 9, 2006, f. April 12, 2006', 'review'),
    (15, 16, 'CR', 'Church Records', 'note', 'buried October 1, 1942, 78y', NULL::date, 'CR: buried October 1, 1942, 78y', 'review'),
    (15, 18, 'CR', 'Church Records', 'death_date', 'October 14, 1955', DATE '1955-10-14', 'CR: Christina F Ulemberg., d. October 14, 1955. Funeral conducted by Rev. Martin, member of Salem Methodist', 'high'),
    (15, 18, 'CR', 'Church Records', 'note', 'Christina F Ulemberg., d. October 14, 1955. Funeral conducted by Rev. Martin, member of Salem Methodist', NULL::date, 'CR: Christina F Ulemberg., d. October 14, 1955. Funeral conducted by Rev. Martin, member of Salem Methodist', 'review'),
    (15, 20, 'CR', 'Church Records', 'death_date', 'January 30, 1983', DATE '1983-01-30', 'CR: Adam, d. January 30, 1983. Clara E., d. November 3, 1978, 72y 8m 7da', 'high'),
    (15, 20, 'CR', 'Church Records', 'death_date', 'November 3, 1978', DATE '1978-11-03', 'CR: Adam, d. January 30, 1983. Clara E., d. November 3, 1978, 72y 8m 7da', 'high'),
    (15, 20, 'CR', 'Church Records', 'note', 'Adam, d. January 30, 1983. Clara E., d. November 3, 1978, 72y 8m 7da', NULL::date, 'CR: Adam, d. January 30, 1983. Clara E., d. November 3, 1978, 72y 8m 7da', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 216
  AND entry.parsed_section_name = 'C'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 216 AND parsed_section_name = 'C' AND parsed_row_number = 15 AND parsed_position_number IN (10, 11, 14, 16, 18, 20)) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 216 AND parsed_section_name = 'C' AND parsed_row_number = 15 AND parsed_position_number IN (10, 18, 19);
