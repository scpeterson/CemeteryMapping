--liquibase formatted sql

--changeset cemeterymapping:203-repair-north-hills-page-223 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 223
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 9, 'SOERGEL/SÖRGEL/SPERBER', ARRAY['SOERGEL','SÖRGEL','SPERBER']::text[], 'D', 3, 8, 'couple', 'obelisk', 'marble', 'poor',
        $nhg$SOERGEL/SÖRGEL/SPERBER (3D, 8, c) obelisk, gray marble, poor cond. Left side: "Joh[-] Soergel / died [-] aged / 67 yrs / [illegible lines]" Right side: "Walburga / Soergel / died / Jan 23 1889 / aged 74 yrs / 5 m. 22 d. / [illegible lines]" CRG: Sörgel, Johann Conrad, b, May 22, 1821 in Henfenfeld, Bavaria, Landgericht (Jurisdiction/local court) Hersbruck, f. December 13, 1888, d. 11 December, 67y, 6m 19da. Walburga Soergel nee Sperber, b. 1st August 1824 at Altensittenbach, Bavaria, d. 25th January 1899 in Franklin T. Allegheny Co. Pa., Buried January 27, 74y 4m 25da. "This lady was a good woman."$nhg$,
        $nhg$Joh[-] Soergel / died [-] aged / 67 yrs / [illegible lines] Walburga / Soergel / died / Jan 23 1889 / aged 74 yrs / 5 m. 22 d. / [illegible lines]$nhg$,
        ARRAY[1821, 1824, 1888, 1889, 1899]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SOERGEL/SÖRGEL/SPERBER (3D, 8, c) obelisk, gray marble, poor cond","descriptor":"obelisk, gray marble, poor cond"}$json$::jsonb
      ),
      (
        10, 12, 'UNKNOWN', ARRAY[]::text[], 'D', 3, 9, 'single', 'upright', 'marble', 'poor',
        $nhg$UNKNOWN (3D, 9, s) upright, gray marble, poor cond "Our Mother"$nhg$,
        $nhg$Our Mother$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"UNKNOWN (3D, 9, s) upright, gray marble, poor cond","descriptor":"upright, gray marble, poor cond"}$json$::jsonb
      ),
      (
        13, 18, 'MAYER', ARRAY['MAYER']::text[], 'D', 3, 10, 'monolith', 'upright', 'granite', 'excellent',
        $nhg$MAYER (3D, 10, monolith) upright, gray granite, exc cond, shaped  like a boulder, very ornate, scroll, leaves, "Mayer" in circle$nhg$,
        $nhg$Mayer$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER (3D, 10, monolith) upright, gray granite, exc cond, shaped like a boulder, very ornate, scroll, leaves","descriptor":"upright, gray granite, exc cond, shaped like a boulder, very ornate, scroll, leaves"}$json$::jsonb
      ),
      (
        42, 45, 'MEYER', ARRAY['MEYER']::text[], 'D', 4, 1, 'single', 'flat', 'sandstone', 'good',
        $nhg$MEYER (4D, 1, s) flat, gray sandstone, good cond, located in middle of row facing sideways "P. S. Meyer"$nhg$,
        $nhg$P. S. Meyer$nhg$,
        ARRAY[]::integer[],
        ARRAY['Located in middle of row facing sideways.']::text[],
        $json${"heading":"MEYER (4D, 1, s) flat, gray sandstone, good cond, located in middle of row facing sideways","descriptor":"flat, gray sandstone, good cond, located in middle of row facing sideways"}$json$::jsonb
      )
  ) AS values(source_line_start, source_line_end, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
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
    223,
    entry_values.source_line_start,
    entry_values.source_line_end,
    entry_values.raw_text,
    entry_values.name_text,
    entry_values.surnames,
    entry_values.parsed_section_name,
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
      AND existing.source_page_number = 223
      AND existing.parsed_section_name = entry_values.parsed_section_name
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
    parsed_section_name = corrections.parsed_section_name,
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
        'D'::varchar, 3, 11, 21, 'MAYER', ARRAY['MAYER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$MAYER (3D, 11, s) upright, gray granite, exc cond, shaped like a boulder "Daughter / Irene M. Mayer / 1895-1913"$nhg$,
        $nhg$Daughter / Irene M. Mayer / 1895-1913$nhg$,
        ARRAY[1895, 1913]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER (3D, 11, s) upright, gray granite, exc cond, shaped like a boulder","descriptor":"upright, gray granite, exc cond, shaped like a boulder"}$json$::jsonb
      ),
      (
        'D'::varchar, 3, 12, 25, 'MAYER', ARRAY['MAYER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$MAYER (3D, 12, s) upright, gray granite, exc cond, shaped like a boulder "Daughter / Elsie A. Mayer/ 1901-1904"$nhg$,
        $nhg$Daughter / Elsie A. Mayer/ 1901-1904$nhg$,
        ARRAY[1901, 1904]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER (3D, 12, s) upright, gray granite, exc cond, shaped like a boulder","descriptor":"upright, gray granite, exc cond, shaped like a boulder"}$json$::jsonb
      ),
      (
        'D'::varchar, 3, 14, 33, 'MAYER', ARRAY['MAYER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$MAYER (3D, 14, s) upright, gray granite, exc cond, shaped like a boulder, in front of monolith, at (3D, 10) "Mother / Louisa M. Mayer / 1872-1939"$nhg$,
        $nhg$Mother / Louisa M. Mayer / 1872-1939$nhg$,
        ARRAY[1872, 1939]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER (3D, 14, s) upright, gray granite, exc cond, shaped like a boulder, in front of monolith, at (3D, 10)","descriptor":"upright, gray granite, exc cond, shaped like a boulder, in front of monolith, at (3D, 10)"}$json$::jsonb
      ),
      (
        'D'::varchar, 3, 15, 39, 'MAYER/GODLOVE', ARRAY['MAYER','GODLOVE']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$MAYER/GODLOVE (3D, 15, s) pillow, gray granite, exc cond, in front of monolith at (3D, 10) "George Godlove Mayer / Pvt US Marine Corps/ enlisted / June 9, 1918 / born June 2, 1897 / discharged Jan. 12, 1920 / died Nov. 29, 1939" Separate flag holder: "American / US / Legion", star$nhg$,
        $nhg$George Godlove Mayer / Pvt US Marine Corps/ enlisted / June 9, 1918 / born June 2, 1897 / discharged Jan. 12, 1920 / died Nov. 29, 1939 American / US / Legion$nhg$,
        ARRAY[1897, 1918, 1920, 1939]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER/GODLOVE (3D, 15, s) pillow, gray granite, exc cond, in front of monolith at (3D, 10)","descriptor":"pillow, gray granite, exc cond, in front of monolith at (3D, 10)"}$json$::jsonb
      ),
      (
        'D'::varchar, 5, 1, 53, 'BRANDT', ARRAY['BRANDT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BRANDT (5D, 1, s) upright, gray granite, exc cond "Nicklaus / Brandt / 1845-1915 / Ruhe in frieden" CR: d. March 23, 1915, 71y$nhg$,
        $nhg$Nicklaus / Brandt / 1845-1915 / Ruhe in frieden$nhg$,
        ARRAY[1845, 1915]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT (5D, 1, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 223
    AND entry.parsed_section_name = corrections.parsed_section_name
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
  WHERE source_page_number = 223
    AND parsed_section_name = 'D'
    AND (
      (parsed_row_number = 3 AND parsed_position_number = 8)
      OR (parsed_row_number = 5 AND parsed_position_number = 1)
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code IN ('CR', 'CRG')
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('D', 3, 8, 'CRG', 'Church Records in German', 'death_date', 'December 11, 1888', DATE '1888-12-11', 'CRG: Sörgel, Johann Conrad, b, May 22, 1821 in Henfenfeld, Bavaria, Landgericht (Jurisdiction/local court) Hersbruck, f. December 13, 1888, d. 11 December, 67y, 6m 19da. Walburga Soergel nee Sperber, b. 1st August 1824 at Altensittenbach, Bavaria, d. 25th January 1899 in Franklin T. Allegheny Co. Pa., Buried January 27, 74y 4m 25da. "This lady was a good woman."', 'high'),
    ('D', 3, 8, 'CRG', 'Church Records in German', 'death_date', 'January 25, 1899', DATE '1899-01-25', 'CRG: Sörgel, Johann Conrad, b, May 22, 1821 in Henfenfeld, Bavaria, Landgericht (Jurisdiction/local court) Hersbruck, f. December 13, 1888, d. 11 December, 67y, 6m 19da. Walburga Soergel nee Sperber, b. 1st August 1824 at Altensittenbach, Bavaria, d. 25th January 1899 in Franklin T. Allegheny Co. Pa., Buried January 27, 74y 4m 25da. "This lady was a good woman."', 'high'),
    ('D', 3, 8, 'CRG', 'Church Records in German', 'note', 'Sörgel, Johann Conrad, b, May 22, 1821 in Henfenfeld, Bavaria, Landgericht (Jurisdiction/local court) Hersbruck, f. December 13, 1888, d. 11 December, 67y, 6m 19da. Walburga Soergel nee Sperber, b. 1st August 1824 at Altensittenbach, Bavaria, d. 25th January 1899 in Franklin T. Allegheny Co. Pa., Buried January 27, 74y 4m 25da. "This lady was a good woman."', NULL::date, 'CRG: Sörgel, Johann Conrad, b, May 22, 1821 in Henfenfeld, Bavaria, Landgericht (Jurisdiction/local court) Hersbruck, f. December 13, 1888, d. 11 December, 67y, 6m 19da. Walburga Soergel nee Sperber, b. 1st August 1824 at Altensittenbach, Bavaria, d. 25th January 1899 in Franklin T. Allegheny Co. Pa., Buried January 27, 74y 4m 25da. "This lady was a good woman."', 'review'),
    ('D', 5, 1, 'CR', 'Church Records', 'death_date', 'March 23, 1915', DATE '1915-03-23', 'CR: d. March 23, 1915, 71y', 'high'),
    ('D', 5, 1, 'CR', 'Church Records', 'note', 'd. March 23, 1915, 71y', NULL::date, 'CR: d. March 23, 1915, 71y', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 223
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 223 AND parsed_section_name = 'D' AND ((parsed_row_number = 3 AND parsed_position_number = 8) OR (parsed_row_number = 5 AND parsed_position_number = 1))) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 223 AND ((parsed_section_name = 'D' AND parsed_row_number = 3 AND parsed_position_number IN (8, 9, 10)) OR (parsed_section_name = 'D' AND parsed_row_number = 4 AND parsed_position_number = 1));
