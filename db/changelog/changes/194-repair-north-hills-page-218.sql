--liquibase formatted sql

--changeset cemeterymapping:194-repair-north-hills-page-218 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 218
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        15, 16, 'RANKER/BRUECKMAN', ARRAY['RANKER','BRUECKMAN']::text[], 16, 10, 'single', 'flat', 'bronze', 'excellent',
        $nhg$RANKER/BRUECKMAN (16C, 10, s} flat, bronze, exc cond, cross "Carol Brueckman/ Ranker / Loving wife and mother / Jul 17 1929 - May 22, 1999"$nhg$,
        $nhg$Carol Brueckman/ Ranker / Loving wife and mother / Jul 17 1929 - May 22, 1999$nhg$,
        ARRAY[1929, 1999]::integer[],
        ARRAY[]::text[],
        $json${"heading":"RANKER/BRUECKMAN (16C, 10, s} flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
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
    218,
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
      AND existing.source_page_number = 218
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
        16, 9, 14, 'BRUECKMAN', ARRAY['BRUECKMAN']::text[], 'single', 'flat', 'bronze', 'excellent',
        $nhg$BRUECKMAN (16C, 9, s) flat, bronze, exc cond, cross "William W. Brueckman / Sgt Army Air Forces / Aug 5 1924  May 31 1974"$nhg$,
        $nhg$William W. Brueckman / Sgt Army Air Forces / Aug 5 1924  May 31 1974$nhg$,
        ARRAY[1924, 1974]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRUECKMAN (16C, 9, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (
        16, 10, 16, 'RANKER/BRUECKMAN', ARRAY['RANKER','BRUECKMAN']::text[], 'single', 'flat', 'bronze', 'excellent',
        $nhg$RANKER/BRUECKMAN (16C, 10, s} flat, bronze, exc cond, cross "Carol Brueckman/ Ranker / Loving wife and mother / Jul 17 1929 - May 22, 1999"$nhg$,
        $nhg$Carol Brueckman/ Ranker / Loving wife and mother / Jul 17 1929 - May 22, 1999$nhg$,
        ARRAY[1929, 1999]::integer[],
        ARRAY[]::text[],
        $json${"heading":"RANKER/BRUECKMAN (16C, 10, s} flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (
        16, 11, 20, 'KAELIN', ARRAY['KAELIN']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$KAELIN (16C, 11, c) upright, gray granite, exc cond, flower, leaves "Kaelin / Elmer B. / May 4, 1900 / July 11, 1958 / Father  Elizabeth A. / June 22, 1896 / Feb. 27, 1974 / Mother" On back: "Kaelin"$nhg$,
        $nhg$Kaelin / Elmer B. / May 4, 1900 / July 11, 1958 / Father  Elizabeth A. / June 22, 1896 / Feb. 27, 1974 / Mother On back: Kaelin$nhg$,
        ARRAY[1896, 1900, 1958, 1974]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KAELIN (16C, 11, c) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        16, 12, 23, 'LEIDECKER', ARRAY['LEIDECKER']::text[], 'single', 'flat', 'metal', 'excellent',
        $nhg$LEIDECKER (16C, 12, s) flat, green metal, exc cond, open Bible "George Henry Leidecker / 1877-1943" CR: d. July 2, 1943$nhg$,
        $nhg$George Henry Leidecker / 1877-1943$nhg$,
        ARRAY[1877, 1943]::integer[],
        ARRAY[]::text[],
        $json${"heading":"LEIDECKER (16C, 12, s) flat, green metal, exc cond, open Bible","descriptor":"flat, green metal, exc cond, open Bible"}$json$::jsonb
      ),
      (
        16, 13, 27, 'LEIDECKER/SHENOT', ARRAY['LEIDECKER','SHENOT']::text[], 'single', 'flat', 'metal', 'excellent',
        $nhg$LEIDECKER/SHENOT (16C, 13, s) flat, green metal, exc cond, open Bible "Emma Shenot Leidecker / 1876-1955" CR: Emma E., d. January 6, 1955, 77y 4m 5da$nhg$,
        $nhg$Emma Shenot Leidecker / 1876-1955$nhg$,
        ARRAY[1876, 1955]::integer[],
        ARRAY[]::text[],
        $json${"heading":"LEIDECKER/SHENOT (16C, 13, s) flat, green metal, exc cond, open Bible","descriptor":"flat, green metal, exc cond, open Bible"}$json$::jsonb
      ),
      (
        16, 14, 32, 'WOCHLEY/LEIDECKER', ARRAY['WOCHLEY','LEIDECKER']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$WOCHLEY/LEIDECKER (16C, 14, c) upright, gray granite, exc cond, ivy "Wochley / Arthur / Dennis/ Feb. 8, 1903 / Mar. 21, 1984 / Lucell / Leidecker / Jan. 3, 1907 / June 28, 1965 / Lo, I am with your always" On back: "Wochley"$nhg$,
        $nhg$Wochley / Arthur / Dennis/ Feb. 8, 1903 / Mar. 21, 1984 / Lucell / Leidecker / Jan. 3, 1907 / June 28, 1965 / Lo, I am with your always On back: Wochley$nhg$,
        ARRAY[1903, 1907, 1965, 1984]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WOCHLEY/LEIDECKER (16C, 14, c) upright, gray granite, exc cond, ivy","descriptor":"upright, gray granite, exc cond, ivy"}$json$::jsonb
      ),
      (
        16, 15, 36, 'WOLFARTH', ARRAY['WOLFARTH']::text[], 'single', 'flat', 'granite', 'excellent',
        $nhg$WOLFARTH (16C, 15, s) flat, gray granite, exc cond, cross ''Raymond A. Woifarth / Tec 5 US Army / World War II / Jan 24 1921 - Jul 4 1990" Separate flag holder: "US / Veteran", star$nhg$,
        $nhg$Raymond A. Woifarth / Tec 5 US Army / World War II / Jan 24 1921 - Jul 4 1990 US / Veteran$nhg$,
        ARRAY[1921, 1990]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WOLFARTH (16C, 15, s) flat, gray granite, exc cond, cross","descriptor":"flat, gray granite, exc cond, cross"}$json$::jsonb
      ),
      (
        16, 16, 40, 'DENT', ARRAY['DENT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$DENT (16C, 16, s) upright, gray granite, exc cond "Andrew J. Dent / 1866-1947 / Father" CR: Middle name James, d. January 19, 1947, 80y 11m 26da$nhg$,
        $nhg$Andrew J. Dent / 1866-1947 / Father$nhg$,
        ARRAY[1866, 1947]::integer[],
        ARRAY[]::text[],
        $json${"heading":"DENT (16C, 16, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        16, 18, 50, 'LUSTER', ARRAY['LUSTER']::text[], 'single', 'upright', 'granite', 'good',
        $nhg$LUSTER (16C, 18, s) upright, orange granite, good cond, airplane, flowers, leaves "Luster / George Wm. Jr. / 1937-1957" CR: d. November 1, 1957, 20y 7m 20da, son of Mary$nhg$,
        $nhg$Luster / George Wm. Jr. / 1937-1957$nhg$,
        ARRAY[1937, 1957]::integer[],
        ARRAY['Row begins about 30 feet from the road.']::text[],
        $json${"heading":"LUSTER (16C, 18, s) upright, orange granite, good cond, airplane, flowers, leaves","descriptor":"upright, orange granite, good cond, airplane, flowers, leaves"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 218
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
  WHERE source_page_number = 218
    AND parsed_section_name = 'C'
    AND parsed_row_number = 16
    AND parsed_position_number IN (12, 13, 16, 18)
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
    (16, 12, 'CR', 'Church Records', 'death_date', 'July 2, 1943', DATE '1943-07-02', 'CR: d. July 2, 1943', 'high'),
    (16, 12, 'CR', 'Church Records', 'note', 'd. July 2, 1943', NULL::date, 'CR: d. July 2, 1943', 'review'),
    (16, 13, 'CR', 'Church Records', 'death_date', 'January 6, 1955', DATE '1955-01-06', 'CR: Emma E., d. January 6, 1955, 77y 4m 5da', 'high'),
    (16, 13, 'CR', 'Church Records', 'note', 'Emma E., d. January 6, 1955, 77y 4m 5da', NULL::date, 'CR: Emma E., d. January 6, 1955, 77y 4m 5da', 'review'),
    (16, 16, 'CR', 'Church Records', 'death_date', 'January 19, 1947', DATE '1947-01-19', 'CR: Middle name James, d. January 19, 1947, 80y 11m 26da', 'high'),
    (16, 16, 'CR', 'Church Records', 'note', 'Middle name James, d. January 19, 1947, 80y 11m 26da', NULL::date, 'CR: Middle name James, d. January 19, 1947, 80y 11m 26da', 'review'),
    (16, 18, 'CR', 'Church Records', 'death_date', 'November 1, 1957', DATE '1957-11-01', 'CR: d. November 1, 1957, 20y 7m 20da, son of Mary', 'high'),
    (16, 18, 'CR', 'Church Records', 'note', 'd. November 1, 1957, 20y 7m 20da, son of Mary', NULL::date, 'CR: d. November 1, 1957, 20y 7m 20da, son of Mary', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 218
  AND entry.parsed_section_name = 'C'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 218 AND parsed_section_name = 'C' AND parsed_row_number = 16 AND parsed_position_number IN (12, 13, 16, 18)) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 218 AND parsed_section_name = 'C' AND parsed_row_number = 16 AND parsed_position_number = 10;
