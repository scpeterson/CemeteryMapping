--liquibase formatted sql

--changeset cemeterymapping:210-repair-north-hills-page-228 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 228
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        33, 34, '[PFEIFFER]', ARRAY['PFEIFFER']::text[], 'E', 2, 1, 'single', 'upright', 'granite', 'excellent',
        $nhg$[PFEIFFER] (2E, 1, s) upright, gray granite, exc cond "Infant / 1860- 1860" Note: Stone is same design, color, and shape as (E2, 2)$nhg$,
        $nhg$Infant / 1860- 1860$nhg$,
        ARRAY[1860]::integer[],
        ARRAY['Stone is same design, color, and shape as (E2, 2).']::text[],
        $json${"heading":"[PFEIFFER] (2E, 1, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        40, 42, 'SCHNABEL', ARRAY['SCHNABEL']::text[], 'E', 3, 1, 'single', 'upright', 'marble', 'poor',
        $nhg$SCHNABEL (3E, 1, s) upright, white marble, poor cond "Kind. / Sohn Von / Phillip und Mariah / Schnabel / Todtgeboren / den 19 Okt. 1863"$nhg$,
        $nhg$Kind. / Sohn Von / Phillip und Mariah / Schnabel / Todtgeboren / den 19 Okt. 1863$nhg$,
        ARRAY[1863]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHNABEL (3E, 1, s) upright, white marble, poor cond","descriptor":"upright, white marble, poor cond"}$json$::jsonb
      ),
      (
        48, 49, '[WILL]', ARRAY['WILL']::text[], 'E', 3, 3, 'single', 'upright', 'marble', NULL::varchar,
        $nhg$[WILL] (3E, 3, s) upright, white marble, illegible, fallen. Note: This stone is the same size and shape as (3E, 2)$nhg$,
        $nhg$$nhg$,
        ARRAY[]::integer[],
        ARRAY['Illegible inscription.', 'This stone is the same size and shape as (3E, 2).']::text[],
        $json${"heading":"[WILL] (3E, 3, s) upright, white marble, illegible, fallen","descriptor":"upright, white marble, illegible, fallen"}$json$::jsonb
      ),
      (
        50, 51, '[WILL]', ARRAY['WILL']::text[], 'E', 3, 4, 'single', 'upright', 'marble', NULL::varchar,
        $nhg$[WILL] (3E, 4, s) upright, white marble, illegible, flower$nhg$,
        $nhg$$nhg$,
        ARRAY[]::integer[],
        ARRAY['Illegible inscription.']::text[],
        $json${"heading":"[WILL] (3E, 4, s) upright, white marble, illegible, flower","descriptor":"upright, white marble, illegible, flower"}$json$::jsonb
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
    228,
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
      AND existing.source_page_number = 228
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
        'D', 11, 1, 10, 'BRANT', ARRAY['BRANT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRANT (11D, 1, c) upright, gray granite, exc cond, flowers, head of horse "Brant / Clifford Chester/  Feb 19, 1920 / Nov 12 1976 / Father / Jacqueline Lois / Jan. 31, 1922 / Mar. 23, 1998 / Mother" On back: "Brant" Bronze military marker: "Clifford Chester Brant / Tec 4 US Army/ World War II / Feb 19 1920 - Nov 12 1976" Separate flag holder: "World War II / Veteran", eagle. Bronze urn at base of tombstone$nhg$,
        $nhg$Brant / Clifford Chester/  Feb 19, 1920 / Nov 12 1976 / Father / Jacqueline Lois / Jan. 31, 1922 / Mar. 23, 1998 / Mother Brant Clifford Chester Brant / Tec 4 US Army/ World War II / Feb 19 1920 - Nov 12 1976 World War II / Veteran$nhg$,
        ARRAY[1920, 1922, 1976, 1998]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT (11D, 1, c) upright, gray granite, exc cond, flowers, head of horse","descriptor":"upright, gray granite, exc cond, flowers, head of horse"}$json$::jsonb
      ),
      (
        'D', 11, 2, 15, 'BRANT', ARRAY['BRANT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRANT (11D, 2, c) upright, gray granite, exc cond, wheat, head of horse "Gone but not forgotten / Clifford Cornell / May 4, 1953 / Mar. 19, 1988 / Father / Bonnie Louise / June 2 1955 / Mother" On back: "Brant" CR: Clifford Brant Jr., buried March 23, 1988$nhg$,
        $nhg$Gone but not forgotten / Clifford Cornell / May 4, 1953 / Mar. 19, 1988 / Father / Bonnie Louise / June 2 1955 / Mother Brant$nhg$,
        ARRAY[1953, 1955, 1988]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT (11D, 2, c) upright, gray granite, exc cond, wheat, head of horse","descriptor":"upright, gray granite, exc cond, wheat, head of horse"}$json$::jsonb
      ),
      (
        'E', 1, 1, 19, 'MARSCHY', ARRAY['MARSCHY']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$MARSCHY (1E, 1, s) upright, white marble, poor cond, rose "Gottlieb / Marschy / geb(?) gest(?) Jul. 1861(?) / [illegible lines]"$nhg$,
        $nhg$Gottlieb / Marschy / geb(?) gest(?) Jul. 1861(?) / [illegible lines]$nhg$,
        ARRAY[1861]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MARSCHY (1E, 1, s) upright, white marble, poor cond, rose","descriptor":"upright, white marble, poor cond, rose"}$json$::jsonb
      ),
      (
        'E', 1, 2, 25, 'MARSCHY', ARRAY['MARSCHY']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$MARSCHY (1E, 2, s) upright, white marble, poor cond, fallen, sunken, open book "Hier Ruhet In Gott / Albert / Marschy / geb. d. 22 Mar. 1836 / gest. d. 7. Mal 1862."$nhg$,
        $nhg$Hier Ruhet In Gott / Albert / Marschy / geb. d. 22 Mar. 1836 / gest. d. 7. Mal 1862.$nhg$,
        ARRAY[1836, 1862]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MARSCHY (1E, 2, s) upright, white marble, poor cond, fallen, sunken, open book","descriptor":"upright, white marble, poor cond, fallen, sunken, open book"}$json$::jsonb
      ),
      (
        'E', 1, 3, 31, 'HEEP/UBERSAX', ARRAY['HEEP','UBERSAX']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$HEEP/UBERSAX (1E, 3, s) upright, gray granite, exc cond "In memory of / Ubersax / Family / Mary Heep / nee Ubersax / 1842- 1933" Separate flag holder: "US American Legion"$nhg$,
        $nhg$In memory of / Ubersax / Family / Mary Heep / nee Ubersax / 1842- 1933 US American Legion$nhg$,
        ARRAY[1842, 1933]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HEEP/UBERSAX (1E, 3, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        'E', 3, 2, 47, 'WILL', ARRAY['WILL']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$WILL (3E, 2, s) upright, white marble, poor cond "Hier ruhet In Gott / Christine N[-] / [tochter] von / J & C Will / geb. d. 22 Dec.(?) 1847 / ges. d. 31 Jan. 1861. / [illegible lines]"$nhg$,
        $nhg$Hier ruhet In Gott / Christine N[-] / [tochter] von / J & C Will / geb. d. 22 Dec.(?) 1847 / ges. d. 31 Jan. 1861. / [illegible lines]$nhg$,
        ARRAY[1847, 1861]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WILL (3E, 2, s) upright, white marble, poor cond","descriptor":"upright, white marble, poor cond"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 228
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
  WHERE source_page_number = 228
    AND (
      (parsed_section_name = 'D' AND parsed_row_number = 11 AND parsed_position_number IN (2))
      OR (parsed_section_name = 'E' AND parsed_row_number = 1 AND parsed_position_number IN (2))
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code IN ('CR', 'CRG')
  RETURNING fact.id
),
removed_observations AS (
  DELETE FROM north_hills_ocr_entry_observations observation
  USING affected_entries
  WHERE observation.entry_id = affected_entries.id
    AND (
      (observation.observation_type = 'plot_marker' AND observation.observation_text = 'Two 6 inches x 6 inches white marble plot markers, "U"')
      OR (observation.observation_type = 'gap' AND observation.observation_text = 'Gap, about 20 feet')
    )
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('D', 11, 2, 'CR', 'Church Records', 'note', 'Clifford Brant Jr., buried March 23, 1988', NULL::date, 'CR: Clifford Brant Jr., buried March 23, 1988', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 228
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

INSERT INTO north_hills_ocr_entry_observations (entry_id, observation_type, observation_text, status)
SELECT entry.id, observation.observation_type, observation.observation_text, 'staged'
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('E', 1, 2, 'plot_marker', 'Two 6 inches x 6 inches white marble plot markers, "U"'),
    ('E', 1, 2, 'gap', 'Gap, about 20 feet')
) AS observation(parsed_section_name, parsed_row_number, parsed_position_number, observation_type, observation_text)
  ON observation.parsed_section_name = entry.parsed_section_name
 AND observation.parsed_row_number = entry.parsed_row_number
 AND observation.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 228
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 228 AND parsed_section_name = 'E' AND parsed_row_number = 1 AND parsed_position_number = 2) AND observation_text IN ('Two 6 inches x 6 inches white marble plot markers, "U"', 'Gap, about 20 feet');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 228 AND parsed_section_name = 'D' AND parsed_row_number = 11 AND parsed_position_number = 2) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 228 AND ((parsed_section_name = 'E' AND parsed_row_number = 2 AND parsed_position_number = 1 AND name_text = '[PFEIFFER]') OR (parsed_section_name = 'E' AND parsed_row_number = 3 AND parsed_position_number IN (1, 3, 4)));
