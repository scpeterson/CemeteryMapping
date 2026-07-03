--liquibase formatted sql

--changeset cemeterymapping:196-repair-north-hills-page-219 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 219
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        8, 8, 'KIVLAN', ARRAY['KIVLAN']::text[], NULL::integer, NULL::integer, NULL::varchar, 'new grave', NULL::varchar, NULL::varchar,
        $nhg$KIVLAN new grave, no tombstone. CR: Harold B. Kivlan, Jr. b. June 2, 1924, d. July 21, 2006$nhg$,
        $nhg$Harold B. Kivlan, Jr. b. June 2, 1924, d. July 21, 2006$nhg$,
        ARRAY[1924, 2006]::integer[],
        ARRAY['New grave, no tombstone.']::text[],
        $json${"heading":"KIVLAN new grave, no tombstone","descriptor":"new grave, no tombstone"}$json$::jsonb
      ),
      (
        16, 20, 'BOHN/BUCHHOLZ', ARRAY['BOHN','BUCHHOLZ']::text[], 17, 3, 'couple', 'upright', 'granite', 'excellent',
        $nhg$BOHN/BUCHHOLZ (17C, 3, c) upright, gray granite, exc cond, flowers "Bohn / George J. / 1891-1975 / Emma E. / 1893-1977" On back: "Bohn" Separate flag holder: "American / US / Legion" CR: George, d. January 9, 1975, 83y 20da. Emma E. Buchholz Bohn, d. September 16, 1977, 84y 4m 4da$nhg$,
        $nhg$Bohn / George J. / 1891-1975 / Emma E. / 1893-1977 On back: Bohn American / US / Legion$nhg$,
        ARRAY[1891, 1893, 1975, 1977]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BOHN/BUCHHOLZ (17C, 3, c) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
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
    219,
    entry_values.source_line_start,
    entry_values.source_line_end,
    entry_values.raw_text,
    entry_values.name_text,
    entry_values.surnames,
    CASE WHEN entry_values.parsed_row_number IS NULL THEN NULL ELSE 'C' END,
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
      AND existing.source_page_number = 219
      AND existing.name_text = entry_values.name_text
      AND (
        (entry_values.parsed_position_number IS NULL AND existing.source_line_start = entry_values.source_line_start)
        OR (
          existing.parsed_section_name = 'C'
          AND existing.parsed_row_number = entry_values.parsed_row_number
          AND existing.parsed_position_number = entry_values.parsed_position_number
        )
      )
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
        'C'::varchar, 17, 1, 7, 'MORRIS', ARRAY['MORRIS']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$MORRIS (17C, 1, s) pillow, red granite, exc cond "Loretta Morris/ 1906-1960"$nhg$,
        $nhg$Loretta Morris/ 1906-1960$nhg$,
        ARRAY[1906, 1960]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MORRIS (17C, 1, s) pillow, red granite, exc cond","descriptor":"pillow, red granite, exc cond"}$json$::jsonb
      ),
      (
        NULL::varchar, NULL::integer, NULL::integer, 8, 'KIVLAN', ARRAY['KIVLAN']::text[], NULL::varchar, 'new grave', NULL::varchar, NULL::varchar,
        $nhg$KIVLAN new grave, no tombstone. CR: Harold B. Kivlan, Jr. b. June 2, 1924, d. July 21, 2006$nhg$,
        $nhg$Harold B. Kivlan, Jr. b. June 2, 1924, d. July 21, 2006$nhg$,
        ARRAY[1924, 2006]::integer[],
        ARRAY['New grave, no tombstone.']::text[],
        $json${"heading":"KIVLAN new grave, no tombstone","descriptor":"new grave, no tombstone"}$json$::jsonb
      ),
      (
        'C'::varchar, 17, 2, 14, 'PAGANO', ARRAY['PAGANO']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$PAGANO (17C, 2, c) upright, gray granite, exc cond, cross in center of flowers "Pagano / Connie / 1955-1995 / Pat / 1954 [blank]" On back: "Pagano" Flower holder in front of gravestone. CR: Constance, Sept. 12, 1955 - Sept. 30, 1995$nhg$,
        $nhg$Pagano / Connie / 1955-1995 / Pat / 1954 [blank] On back: Pagano Flower holder in front of gravestone$nhg$,
        ARRAY[1954, 1955, 1995]::integer[],
        ARRAY[]::text[],
        $json${"heading":"PAGANO (17C, 2, c) upright, gray granite, exc cond, cross in center of flowers","descriptor":"upright, gray granite, exc cond, cross in center of flowers"}$json$::jsonb
      ),
      (
        'C'::varchar, 17, 3, 20, 'BOHN/BUCHHOLZ', ARRAY['BOHN','BUCHHOLZ']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BOHN/BUCHHOLZ (17C, 3, c) upright, gray granite, exc cond, flowers "Bohn / George J. / 1891-1975 / Emma E. / 1893-1977" On back: "Bohn" Separate flag holder: "American / US / Legion" CR: George, d. January 9, 1975, 83y 20da. Emma E. Buchholz Bohn, d. September 16, 1977, 84y 4m 4da$nhg$,
        $nhg$Bohn / George J. / 1891-1975 / Emma E. / 1893-1977 On back: Bohn American / US / Legion$nhg$,
        ARRAY[1891, 1893, 1975, 1977]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BOHN/BUCHHOLZ (17C, 3, c) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (
        'C'::varchar, 17, 6, 33, 'BOWES/BERINGER', ARRAY['BOWES','BERINGER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BOWES/BERINGER (17C, 6, s) upright, gray granite, exc cond, bowl of flowers "Olive M. Bowes/ July 16, 1897 / May 1, 1977 / Mother" On back: ''Bowes" CR: Olive Malinda Beringer Bowes$nhg$,
        $nhg$Olive M. Bowes/ July 16, 1897 / May 1, 1977 / Mother On back: Bowes$nhg$,
        ARRAY[1897, 1977]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BOWES/BERINGER (17C, 6, s) upright, gray granite, exc cond, bowl of flowers","descriptor":"upright, gray granite, exc cond, bowl of flowers"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 219
    AND (
      (
        corrections.parsed_section_name IS NULL
        AND entry.name_text = corrections.name_text
        AND entry.source_line_start = corrections.source_line_end
      )
      OR (
        entry.parsed_section_name = corrections.parsed_section_name
        AND entry.parsed_row_number = corrections.parsed_row_number
        AND entry.parsed_position_number = corrections.parsed_position_number
      )
    )
  RETURNING entry.id
),
affected_entries AS (
  SELECT id
  FROM updated_entries
  UNION
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 219
    AND (
      (name_text = 'KIVLAN' AND source_line_start = 8)
      OR (parsed_section_name = 'C' AND parsed_row_number = 17 AND parsed_position_number IN (1, 2, 3, 6))
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
    ('KIVLAN', NULL::integer, 'CR', 'Church Records', 'death_date', 'July 21, 2006', DATE '2006-07-21', 'CR: Harold B. Kivlan, Jr. b. June 2, 1924, d. July 21, 2006', 'high'),
    ('KIVLAN', NULL::integer, 'CR', 'Church Records', 'note', 'Harold B. Kivlan, Jr. b. June 2, 1924, d. July 21, 2006', NULL::date, 'CR: Harold B. Kivlan, Jr. b. June 2, 1924, d. July 21, 2006', 'review'),
    ('PAGANO', 2, 'CR', 'Church Records', 'death_date', 'September 30, 1995', DATE '1995-09-30', 'CR: Constance, Sept. 12, 1955 - Sept. 30, 1995', 'high'),
    ('PAGANO', 2, 'CR', 'Church Records', 'note', 'Constance, Sept. 12, 1955 - Sept. 30, 1995', NULL::date, 'CR: Constance, Sept. 12, 1955 - Sept. 30, 1995', 'review'),
    ('BOHN/BUCHHOLZ', 3, 'CR', 'Church Records', 'death_date', 'January 9, 1975', DATE '1975-01-09', 'CR: George, d. January 9, 1975, 83y 20da. Emma E. Buchholz Bohn, d. September 16, 1977, 84y 4m 4da', 'high'),
    ('BOHN/BUCHHOLZ', 3, 'CR', 'Church Records', 'death_date', 'September 16, 1977', DATE '1977-09-16', 'CR: George, d. January 9, 1975, 83y 20da. Emma E. Buchholz Bohn, d. September 16, 1977, 84y 4m 4da', 'high'),
    ('BOHN/BUCHHOLZ', 3, 'CR', 'Church Records', 'note', 'George, d. January 9, 1975, 83y 20da. Emma E. Buchholz Bohn, d. September 16, 1977, 84y 4m 4da', NULL::date, 'CR: George, d. January 9, 1975, 83y 20da. Emma E. Buchholz Bohn, d. September 16, 1977, 84y 4m 4da', 'review'),
    ('BOWES/BERINGER', 6, 'CR', 'Church Records', 'note', 'Olive Malinda Beringer Bowes', NULL::date, 'CR: Olive Malinda Beringer Bowes', 'review')
) AS fact(name_text, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.name_text = entry.name_text
 AND (
   (fact.parsed_position_number IS NULL AND entry.source_line_start = 8)
   OR fact.parsed_position_number = entry.parsed_position_number
 )
WHERE entry.source_page_number = 219
  AND (entry.parsed_section_name = 'C' OR entry.name_text = 'KIVLAN')
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 219 AND ((name_text = 'KIVLAN' AND source_line_start = 8) OR (parsed_section_name = 'C' AND parsed_row_number = 17 AND parsed_position_number IN (1, 2, 3, 6)))) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 219 AND ((name_text = 'KIVLAN' AND source_line_start = 8) OR (parsed_section_name = 'C' AND parsed_row_number = 17 AND parsed_position_number = 3 AND name_text = 'BOHN/BUCHHOLZ'));
