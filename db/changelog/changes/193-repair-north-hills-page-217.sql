--liquibase formatted sql

--changeset cemeterymapping:193-repair-north-hills-page-217 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 217
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 5, 'BRANDT', ARRAY['BRANDT']::text[], 15, 21, 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRANDT (15c, 21, c) upright, gray granite, exc cond "Brandt / H. Carl / 1912 -1997 / Alice R. / 1911-1991" On back: "Brandt"$nhg$,
        $nhg$Brandt / H. Carl / 1912 -1997 / Alice R. / 1911-1991 On back: Brandt$nhg$,
        ARRAY[1911, 1912, 1991, 1997]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT (15c, 21, c) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        7, 13, 'DeCOURCY/DeWITT/HAMILTON', ARRAY['DECOURCY','DEWITT','HAMILTON']::text[], 16, 1, 'couple', 'upright', 'granite', 'excellent',
        $nhg$DeCOURCY/DeWITT/HAMILTON (16C, 1, c) upright, gray granite, exc cond, flower, leaves "DeCourcy / William / DeWitt / 1921 - [blank) / Louise / Hamilton / 1925-1990" On base: small stone memento with stars "Perhaps they are not/  stars in the sky, / but rather openings / where our loved ones / shine down / to let us know they are happy" On back: "DeCourcy"$nhg$,
        $nhg$DeCourcy / William / DeWitt / 1921 - [blank) / Louise / Hamilton / 1925-1990 On base: small stone memento with stars Perhaps they are not/ stars in the sky, / but rather openings / where our loved ones / shine down / to let us know they are happy On back: DeCourcy$nhg$,
        ARRAY[1921, 1925, 1990]::integer[],
        ARRAY[]::text[],
        $json${"heading":"DeCOURCY/DeWITT/HAMILTON (16C, 1, c) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        15, 16, 'DeCOURCY/HAMILTON/DeCOURCEY', ARRAY['DECOURCY','HAMILTON','DECOURCEY']::text[], 16, 2, 'single', 'upright', 'granite', 'excellent',
        $nhg$DeCOURCY/HAMILTON/DeCOURCEY (16C, 2, s) upright, gray granite, exc cond "William Hamilton/ DeCourcy / Nov. 4, 1957" CR: Son o,f William Decourcey, d. December 2, 1957$nhg$,
        $nhg$William Hamilton/ DeCourcy / Nov. 4, 1957$nhg$,
        ARRAY[1957]::integer[],
        ARRAY[]::text[],
        $json${"heading":"DeCOURCY/HAMILTON/DeCOURCEY (16C, 2, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        33, 35, 'BUCHHOLZ', ARRAY['BUCHHOLZ']::text[], 16, 6, 'single', 'upright', 'granite', 'excellent',
        $nhg$BUCHHOLZ (16C, 6, s) upright, gray granite, exc cond, ivy "Aunt / Carrie Buchholz / 1898-1981" Bronze urn in ground CR: Caroline Louise, d. November 11, 1981, 83y 3m 9da$nhg$,
        $nhg$Aunt / Carrie Buchholz / 1898-1981 Bronze urn in ground$nhg$,
        ARRAY[1898, 1981]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BUCHHOLZ (16C, 6, s) upright, gray granite, exc cond, ivy","descriptor":"upright, gray granite, exc cond, ivy"}$json$::jsonb
      ),
      (
        37, 40, 'BUCHHOLZ/CLEESE/BUCKHOLZ', ARRAY['BUCHHOLZ','CLEESE','BUCKHOLZ']::text[], 16, 7, 'single', 'upright', 'granite', 'excellent',
        $nhg$BUCHHOLZ/CLEESE/BUCKHOLZ (16C, 7, s) upright, gray granite, exc cond, ivy "Mother / Nettie Buchholz / 1861-1960" Bronze urn in ground CR: Nettie (Cleese) Buckholz, d. June 6, 1960, 90 y 20 da, born in Germany$nhg$,
        $nhg$Mother / Nettie Buchholz / 1861-1960 Bronze urn in ground$nhg$,
        ARRAY[1861, 1960]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BUCHHOLZ/CLEESE/BUCKHOLZ (16C, 7, s) upright, gray granite, exc cond, ivy","descriptor":"upright, gray granite, exc cond, ivy"}$json$::jsonb
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
    217,
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
      AND existing.source_page_number = 217
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
        15, 21, 5, 'BRANDT', ARRAY['BRANDT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRANDT (15c, 21, c) upright, gray granite, exc cond "Brandt / H. Carl / 1912 -1997 / Alice R. / 1911-1991" On back: "Brandt"$nhg$,
        $nhg$Brandt / H. Carl / 1912 -1997 / Alice R. / 1911-1991 On back: Brandt$nhg$,
        ARRAY[1911, 1912, 1991, 1997]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT (15c, 21, c) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        16, 1, 13, 'DeCOURCY/DeWITT/HAMILTON', ARRAY['DECOURCY','DEWITT','HAMILTON']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$DeCOURCY/DeWITT/HAMILTON (16C, 1, c) upright, gray granite, exc cond, flower, leaves "DeCourcy / William / DeWitt / 1921 - [blank) / Louise / Hamilton / 1925-1990" On base: small stone memento with stars "Perhaps they are not/  stars in the sky, / but rather openings / where our loved ones / shine down / to let us know they are happy" On back: "DeCourcy"$nhg$,
        $nhg$DeCourcy / William / DeWitt / 1921 - [blank) / Louise / Hamilton / 1925-1990 On base: small stone memento with stars Perhaps they are not/ stars in the sky, / but rather openings / where our loved ones / shine down / to let us know they are happy On back: DeCourcy$nhg$,
        ARRAY[1921, 1925, 1990]::integer[],
        ARRAY[]::text[],
        $json${"heading":"DeCOURCY/DeWITT/HAMILTON (16C, 1, c) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        16, 2, 16, 'DeCOURCY/HAMILTON/DeCOURCEY', ARRAY['DECOURCY','HAMILTON','DECOURCEY']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$DeCOURCY/HAMILTON/DeCOURCEY (16C, 2, s) upright, gray granite, exc cond "William Hamilton/ DeCourcy / Nov. 4, 1957" CR: Son o,f William Decourcey, d. December 2, 1957$nhg$,
        $nhg$William Hamilton/ DeCourcy / Nov. 4, 1957$nhg$,
        ARRAY[1957]::integer[],
        ARRAY[]::text[],
        $json${"heading":"DeCOURCY/HAMILTON/DeCOURCEY (16C, 2, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        16, 3, 21, 'WATENPOOL', ARRAY['WATENPOOL']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$WATENPOOL (16C, 3, s) upright, gray granite, exc cond, flower, leaves "Allan J. / Watenpool / 1911-1944" CR: Middle name Joseph, d. December 9, 1944$nhg$,
        $nhg$Allan J. / Watenpool / 1911-1944$nhg$,
        ARRAY[1911, 1944]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WATENPOOL (16C, 3, s) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      ),
      (
        16, 5, 31, 'BLACKFORD', ARRAY['BLACKFORD']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BLACKFORD (16C, 5, s) upright, gray granite, exc cond, flowers, leaves "Byron H. / Blackford / 1902-1983" CR: d. November 28, 1983, 81y 1m 5da$nhg$,
        $nhg$Byron H. / Blackford / 1902-1983$nhg$,
        ARRAY[1902, 1983]::integer[],
        ARRAY['Plot marker, stone "W".']::text[],
        $json${"heading":"BLACKFORD (16C, 5, s) upright, gray granite, exc cond, flowers, leaves","descriptor":"upright, gray granite, exc cond, flowers, leaves"}$json$::jsonb
      ),
      (
        16, 6, 35, 'BUCHHOLZ', ARRAY['BUCHHOLZ']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BUCHHOLZ (16C, 6, s) upright, gray granite, exc cond, ivy "Aunt / Carrie Buchholz / 1898-1981" Bronze urn in ground CR: Caroline Louise, d. November 11, 1981, 83y 3m 9da$nhg$,
        $nhg$Aunt / Carrie Buchholz / 1898-1981 Bronze urn in ground$nhg$,
        ARRAY[1898, 1981]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BUCHHOLZ (16C, 6, s) upright, gray granite, exc cond, ivy","descriptor":"upright, gray granite, exc cond, ivy"}$json$::jsonb
      ),
      (
        16, 7, 40, 'BUCHHOLZ/CLEESE/BUCKHOLZ', ARRAY['BUCHHOLZ','CLEESE','BUCKHOLZ']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BUCHHOLZ/CLEESE/BUCKHOLZ (16C, 7, s) upright, gray granite, exc cond, ivy "Mother / Nettie Buchholz / 1861-1960" Bronze urn in ground CR: Nettie (Cleese) Buckholz, d. June 6, 1960, 90 y 20 da, born in Germany$nhg$,
        $nhg$Mother / Nettie Buchholz / 1861-1960 Bronze urn in ground$nhg$,
        ARRAY[1861, 1960]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BUCHHOLZ/CLEESE/BUCKHOLZ (16C, 7, s) upright, gray granite, exc cond, ivy","descriptor":"upright, gray granite, exc cond, ivy"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 217
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
  WHERE source_page_number = 217
    AND parsed_section_name = 'C'
    AND (
      (parsed_row_number = 16 AND parsed_position_number IN (2, 3, 5, 6, 7))
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
    (16, 2, 'CR', 'Church Records', 'death_date', 'December 2, 1957', DATE '1957-12-02', 'CR: Son o,f William Decourcey, d. December 2, 1957', 'high'),
    (16, 2, 'CR', 'Church Records', 'note', 'Son o,f William Decourcey, d. December 2, 1957', NULL::date, 'CR: Son o,f William Decourcey, d. December 2, 1957', 'review'),
    (16, 3, 'CR', 'Church Records', 'death_date', 'December 9, 1944', DATE '1944-12-09', 'CR: Middle name Joseph, d. December 9, 1944', 'high'),
    (16, 3, 'CR', 'Church Records', 'note', 'Middle name Joseph, d. December 9, 1944', NULL::date, 'CR: Middle name Joseph, d. December 9, 1944', 'review'),
    (16, 5, 'CR', 'Church Records', 'death_date', 'November 28, 1983', DATE '1983-11-28', 'CR: d. November 28, 1983, 81y 1m 5da', 'high'),
    (16, 5, 'CR', 'Church Records', 'note', 'd. November 28, 1983, 81y 1m 5da', NULL::date, 'CR: d. November 28, 1983, 81y 1m 5da', 'review'),
    (16, 6, 'CR', 'Church Records', 'death_date', 'November 11, 1981', DATE '1981-11-11', 'CR: Caroline Louise, d. November 11, 1981, 83y 3m 9da', 'high'),
    (16, 6, 'CR', 'Church Records', 'note', 'Caroline Louise, d. November 11, 1981, 83y 3m 9da', NULL::date, 'CR: Caroline Louise, d. November 11, 1981, 83y 3m 9da', 'review'),
    (16, 7, 'CR', 'Church Records', 'death_date', 'June 6, 1960', DATE '1960-06-06', 'CR: Nettie (Cleese) Buckholz, d. June 6, 1960, 90 y 20 da, born in Germany', 'high'),
    (16, 7, 'CR', 'Church Records', 'note', 'Nettie (Cleese) Buckholz, d. June 6, 1960, 90 y 20 da, born in Germany', NULL::date, 'CR: Nettie (Cleese) Buckholz, d. June 6, 1960, 90 y 20 da, born in Germany', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 217
  AND entry.parsed_section_name = 'C'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 217 AND parsed_section_name = 'C' AND parsed_row_number = 16 AND parsed_position_number IN (2, 3, 5, 6, 7)) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 217 AND parsed_section_name = 'C' AND ((parsed_row_number = 15 AND parsed_position_number = 21) OR (parsed_row_number = 16 AND parsed_position_number IN (1, 2, 6, 7)));
