--liquibase formatted sql

--changeset cemeterymapping:181-repair-north-hills-page-209 splitStatements:false
WITH updated_entries AS (
  UPDATE north_hills_ocr_entries entry
  SET
    raw_text = corrections.raw_text,
    name_text = corrections.name_text,
    surnames = corrections.surnames,
    parsed_row_number = corrections.parsed_row_number,
    parsed_position_number = corrections.parsed_position_number,
    parsed_marker_scope = corrections.parsed_marker_scope,
    marker_type_text = corrections.marker_type_text,
    material_text = corrections.material_text,
    condition_text = corrections.condition_text,
    inscription_text = corrections.inscription_text,
    parsed_years = corrections.parsed_years,
    parse_confidence = 'high',
    parse_notes = ARRAY[]::text[],
    source_entry = corrections.source_entry,
    updated_at = now()
  FROM (
    VALUES
      (
        9, 5, 'KEMPF/SCHOLERT(?)/KEMPT', ARRAY['KEMPF','SCHOLERT','KEMPT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$KEMPF/SCHOLERT(?)/KEMPT (9C, 5, c) upright, gray granite, exc cond, church window, flowers "Kempf/ John P. / 1879-1964 / Husband / Anna / 1881-1978 / Wife" On back: "Kempf" CR: John Peter, d. June 20, 1964, 85y 4m 12da. Anna Scholert(?) Kempt, d. October 10, 1978. 97y 7m 15da$nhg$,
        $nhg$Kempf/ John P. / 1879-1964 / Husband / Anna / 1881-1978 / Wife Kempf$nhg$,
        ARRAY[1879, 1881, 1964, 1978]::integer[],
        $json${"heading":"KEMPF/SCHOLERT(?)/KEMPT (9C, 5, c) upright, gray granite, exc cond, church window, flowers","descriptor":"upright, gray granite, exc cond, church window, flowers"}$json$::jsonb
      ),
      (
        9, 6, 'PEGHER', ARRAY['PEGHER']::text[], 'single', 'pillow', 'granite', 'good',
        $nhg$PEGHER (9C, 6, s) pillow, gray granite, good cond "Simon W. Pegher / Pvt. Co. G. 330th Inf. / enlisted / Oct. 2, 1942 / discharged / Feb. 13, 1943 / born Nov. 8, 1899 died Nov. 10, 1949" Separate flag holder: "American / US / Legion", star CR: d. June 20, 1964, 85y 4m 12da$nhg$,
        $nhg$Simon W. Pegher / Pvt. Co. G. 330th Inf. / enlisted / Oct. 2, 1942 / discharged / Feb. 13, 1943 / born Nov. 8, 1899 died Nov. 10, 1949 American / US / Legion$nhg$,
        ARRAY[1899, 1942, 1943, 1949, 1964]::integer[],
        $json${"heading":"PEGHER (9C, 6, s) pillow, gray granite, good cond","descriptor":"pillow, gray granite, good cond"}$json$::jsonb
      ),
      (
        9, 7, 'PEGHER/BRANDT', ARRAY['PEGHER','BRANDT']::text[], 'single', 'upright', 'granite', NULL::text,
        $nhg$PEGHER/BRANDT (9C, 7, s) upright, gray granite, lilies "Mother/ Margaret Pegher / 1864-1920 / erected by her son Wilbert'' CR: Mrs. Margaret Brandt Pegher, d. May 21, 1920$nhg$,
        $nhg$Mother/ Margaret Pegher / 1864-1920 / erected by her son Wilbert'$nhg$,
        ARRAY[1864, 1920]::integer[],
        $json${"heading":"PEGHER/BRANDT (9C, 7, s) upright, gray granite, lilies","descriptor":"upright, gray granite, lilies"}$json$::jsonb
      ),
      (
        9, 9, 'LUSKEY/BERINGER', ARRAY['LUSKEY','BERINGER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$LUSKEY/BERINGER (9C, 9, s) upright, gray granite, exc cond, flowers "Emma C. Luskey / June 10, 1888 / June 2, 1955 / Wife" CR: Mrs. Emma C. Beringer Luskey, buried June 5, 66y 11m 22da$nhg$,
        $nhg$Emma C. Luskey / June 10, 1888 / June 2, 1955 / Wife$nhg$,
        ARRAY[1888, 1955]::integer[],
        $json${"heading":"LUSKEY/BERINGER (9C, 9, s) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (
        9, 10, 'LUSKEY', ARRAY['LUSKEY']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$LUSKEY (9C, 10, c) upright, gray granite, exc cond "Luskey / Edward P. / Mar. 12, 1921 / Sept. 28, 1989 / Viola L. / Mar. 13, 1920 / May 26, 2002."$nhg$,
        $nhg$Luskey / Edward P. / Mar. 12, 1921 / Sept. 28, 1989 / Viola L. / Mar. 13, 1920 / May 26, 2002.$nhg$,
        ARRAY[1920, 1921, 1989, 2002]::integer[],
        $json${"heading":"LUSKEY (9C, 10, c) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        10, 1, 'KNOBELOCH/DEXTER', ARRAY['KNOBELOCH','DEXTER']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$KNOBELOCH/DEXTER (10C, 1 c) upright, gray granite, exc cond, grapes, leaves "Knobeloch/ Christy C. / Mar. 15, 1908 / Sept. 27, 1979 / Father / Grace D. / Apr. 29, 1905 / Sept. 17, 1964 / Mother" On back: "Knobeloch" CR: Grace Dexter, Christy's wife$nhg$,
        $nhg$Knobeloch/ Christy C. / Mar. 15, 1908 / Sept. 27, 1979 / Father / Grace D. / Apr. 29, 1905 / Sept. 17, 1964 / Mother Knobeloch$nhg$,
        ARRAY[1905, 1908, 1964, 1979]::integer[],
        $json${"heading":"KNOBELOCH/DEXTER (10C, 1 c) upright, gray granite, exc cond, grapes, leaves","descriptor":"upright, gray granite, exc cond, grapes, leaves"}$json$::jsonb
      ),
      (
        10, 3, 'REASEY', ARRAY['REASEY']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$REASEY (10C, 3, s) upright, gray granite, exc cond, angel, sad face, cross, flowers "Our special angel / Courtney Jane / Reasey / April 12, 1985 / Sept. 19, / 1985" On back: "Reasey"$nhg$,
        $nhg$Our special angel / Courtney Jane / Reasey / April 12, 1985 / Sept. 19, / 1985 Reasey$nhg$,
        ARRAY[1985]::integer[],
        $json${"heading":"REASEY (10C, 3, s) upright, gray granite, exc cond, angel, sad face, cross, flowers","descriptor":"upright, gray granite, exc cond, angel, sad face, cross, flowers"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, source_entry)
  WHERE entry.source_page_number = 209
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
  SELECT id, batch_id, cemetery_id, source_page_index, source_page_number, source_line_start
  FROM north_hills_ocr_entries
  WHERE source_page_number = 209
    AND parsed_section_name = 'C'
    AND parsed_row_number = 9
    AND parsed_position_number = 10
    AND name_text = 'LUSKEY'
),
inserted AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    source_entries.batch_id,
    source_entries.cemetery_id,
    source_entries.source_page_index,
    209,
    candidate.line_start,
    candidate.line_start,
    $nhg$BLANCHARD (9C, 11, s) pillow, gray granite, exc cond, cross, flowers "Marion A. Blanchard/ 1930 1980 / The Lord is my Sheperd" [sic] CR: d. August 1, 1980, 49y 10m 25da$nhg$,
    'BLANCHARD',
    ARRAY['BLANCHARD']::text[],
    'C',
    9,
    11,
    'single',
    'pillow',
    'granite',
    'excellent',
    $nhg$Marion A. Blanchard/ 1930 1980 / The Lord is my Sheperd$nhg$,
    ARRAY[1930, 1980]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"BLANCHARD (9C, 11, s) pillow, gray granite, exc cond, cross, flowers","descriptor":"pillow, gray granite, exc cond, cross, flowers"}$json$::jsonb
  FROM source_entries
  CROSS JOIN LATERAL (
    SELECT line_start
    FROM generate_series(source_entries.source_line_start + 1, source_entries.source_line_start + 30) AS candidates(line_start)
    WHERE NOT EXISTS (
      SELECT 1
      FROM north_hills_ocr_entries existing
      WHERE existing.batch_id = source_entries.batch_id
        AND existing.source_page_index = source_entries.source_page_index
        AND existing.source_line_start = candidates.line_start
    )
    ORDER BY line_start
    LIMIT 1
  ) AS candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = source_entries.batch_id
      AND existing.source_page_number = 209
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 9
      AND existing.parsed_position_number = 11
      AND existing.name_text = 'BLANCHARD'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. August 1, 1980, 49y 10m 25da', NULL::date, 'CR: d. August 1, 1980, 49y 10m 25da', 'review'
FROM inserted
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 1, 1980', DATE '1980-08-01', 'CR: d. August 1, 1980, 49y 10m 25da', 'high'
FROM inserted
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '49y 10m 25d', NULL::date, 'CR: d. August 1, 1980, 49y 10m 25da', 'medium'
FROM inserted
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH source_entries AS (
  SELECT id, batch_id, cemetery_id, source_page_index, source_page_number, source_line_start
  FROM north_hills_ocr_entries
  WHERE source_page_number = 209
    AND parsed_section_name = 'C'
    AND parsed_row_number = 10
    AND parsed_position_number = 1
    AND name_text = 'KNOBELOCH/DEXTER'
),
inserted AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    source_entries.batch_id,
    source_entries.cemetery_id,
    source_entries.source_page_index,
    209,
    candidate.line_start,
    candidate.line_start,
    $nhg$WATTS (10C, 2, s) pillow, gray granite, exc cond, cross, flower, leaves "Walter J. Watts / Jan. 27, 1931 / Apr. 18, 1986"$nhg$,
    'WATTS',
    ARRAY['WATTS']::text[],
    'C',
    10,
    2,
    'single',
    'pillow',
    'granite',
    'excellent',
    $nhg$Walter J. Watts / Jan. 27, 1931 / Apr. 18, 1986$nhg$,
    ARRAY[1931, 1986]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"WATTS (10C, 2, s) pillow, gray granite, exc cond, cross, flower, leaves","descriptor":"pillow, gray granite, exc cond, cross, flower, leaves"}$json$::jsonb
  FROM source_entries
  CROSS JOIN LATERAL (
    SELECT line_start
    FROM generate_series(source_entries.source_line_start + 1, source_entries.source_line_start + 30) AS candidates(line_start)
    WHERE NOT EXISTS (
      SELECT 1
      FROM north_hills_ocr_entries existing
      WHERE existing.batch_id = source_entries.batch_id
        AND existing.source_page_index = source_entries.source_page_index
        AND existing.source_line_start = candidates.line_start
    )
    ORDER BY line_start
    LIMIT 1
  ) AS candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = source_entries.batch_id
      AND existing.source_page_number = 209
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 10
      AND existing.parsed_position_number = 2
      AND existing.name_text = 'WATTS'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted;

WITH affected_entries AS (
  SELECT id, parsed_row_number, parsed_position_number, name_text
  FROM north_hills_ocr_entries
  WHERE source_page_number = 209
    AND parsed_section_name = 'C'
    AND (
      (parsed_row_number = 9 AND parsed_position_number IN (5, 6, 7, 9, 11))
      OR (parsed_row_number = 10 AND parsed_position_number = 1)
    )
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'John Peter, d. June 20, 1964, 85y 4m 12da. Anna Scholert(?) Kempt, d. October 10, 1978. 97y 7m 15da', NULL::date, 'CR: John Peter, d. June 20, 1964, 85y 4m 12da. Anna Scholert(?) Kempt, d. October 10, 1978. 97y 7m 15da', 'review'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 5
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'June 20, 1964', DATE '1964-06-20', 'CR: John Peter, d. June 20, 1964, 85y 4m 12da. Anna Scholert(?) Kempt, d. October 10, 1978. 97y 7m 15da', 'high'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 5
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'October 10, 1978', DATE '1978-10-10', 'CR: John Peter, d. June 20, 1964, 85y 4m 12da. Anna Scholert(?) Kempt, d. October 10, 1978. 97y 7m 15da', 'high'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 5
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. June 20, 1964, 85y 4m 12da', NULL::date, 'CR: d. June 20, 1964, 85y 4m 12da', 'review'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 6
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'June 20, 1964', DATE '1964-06-20', 'CR: d. June 20, 1964, 85y 4m 12da', 'high'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 6
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Mrs. Margaret Brandt Pegher, d. May 21, 1920', NULL::date, 'CR: Mrs. Margaret Brandt Pegher, d. May 21, 1920', 'review'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 7
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 21, 1920', DATE '1920-05-21', 'CR: Mrs. Margaret Brandt Pegher, d. May 21, 1920', 'high'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 7
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Mrs. Emma C. Beringer Luskey, buried June 5, 66y 11m 22da', NULL::date, 'CR: Mrs. Emma C. Beringer Luskey, buried June 5, 66y 11m 22da', 'review'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 9
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '66y 11m 22d', NULL::date, 'CR: Mrs. Emma C. Beringer Luskey, buried June 5, 66y 11m 22da', 'medium'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 9
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. August 1, 1980, 49y 10m 25da', NULL::date, 'CR: d. August 1, 1980, 49y 10m 25da', 'review'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 11
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 1, 1980', DATE '1980-08-01', 'CR: d. August 1, 1980, 49y 10m 25da', 'high'
FROM affected_entries WHERE parsed_row_number = 9 AND parsed_position_number = 11
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Grace Dexter, Christy''s wife', NULL::date, 'CR: Grace Dexter, Christy''s wife', 'review'
FROM affected_entries WHERE parsed_row_number = 10 AND parsed_position_number = 1
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 209 AND parsed_section_name = 'C' AND ((parsed_row_number = 9 AND parsed_position_number IN (5, 6, 7, 9, 11)) OR (parsed_row_number = 10 AND parsed_position_number = 1))) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 209 AND parsed_section_name = 'C' AND ((parsed_row_number = 9 AND parsed_position_number = 11 AND name_text = 'BLANCHARD') OR (parsed_row_number = 10 AND parsed_position_number = 2 AND name_text = 'WATTS'));
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
