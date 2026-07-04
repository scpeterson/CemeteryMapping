--liquibase formatted sql

--changeset cemeterymapping:200-repair-north-hills-page-221 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 221
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 6, 'MAYER', ARRAY['MAYER']::text[], 'D', 1, 3, 'single', 'upright', 'granite', 'excellent',
        $nhg$MAYER (1D, 3, s) upright, gray granite, exc cond "Mother / Magd. Mayer"$nhg$,
        $nhg$Mother / Magd. Mayer$nhg$,
        ARRAY[]::integer[],
        ARRAY['Markers for stones in Row 1D are found in Row 2D.']::text[],
        $json${"heading":"MAYER (1D, 3, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        21, 23, 'ENSMIGER', ARRAY['ENSMIGER']::text[], 'D', 2, 3, 'single', 'flat', 'marble', 'poor',
        $nhg$ENSMIGER (2D, 3, s) flat, white marble, 10x10 inches, poor cond, sunken ''Heinrich / Ensmiger" See obelisk at (1D, 2)$nhg$,
        $nhg$Heinrich / Ensmiger$nhg$,
        ARRAY[]::integer[],
        ARRAY['See obelisk at (1D, 2).']::text[],
        $json${"heading":"ENSMIGER (2D, 3, s) flat, white marble, 10x10 inches, poor cond, sunken","descriptor":"flat, white marble, 10x10 inches, poor cond, sunken"}$json$::jsonb
      ),
      (
        24, 26, 'MAYER', ARRAY['MAYER']::text[], 'D', 2, 4, 'single', 'flat', 'marble', 'poor',
        $nhg$MAYER (2D, 4, s) flat, white marble, 10x10 inches, poor cond, sunken "Friedrich Phil. / Mayer" See obelisk at (1D, 2)$nhg$,
        $nhg$Friedrich Phil. / Mayer$nhg$,
        ARRAY[]::integer[],
        ARRAY['See obelisk at (1D, 2).']::text[],
        $json${"heading":"MAYER (2D, 4, s) flat, white marble, 10x10 inches, poor cond, sunken","descriptor":"flat, white marble, 10x10 inches, poor cond, sunken"}$json$::jsonb
      ),
      (
        27, 29, 'ENSMIGER', ARRAY['ENSMIGER']::text[], 'D', 2, 5, 'single', 'flat', 'marble', 'poor',
        $nhg$ENSMIGER (2D, 5, s) flat, white marble, 10x10 inches, poor cond, sunken "Margaretha / Ensmiger" See obelisk at (1D, 2)$nhg$,
        $nhg$Margaretha / Ensmiger$nhg$,
        ARRAY[]::integer[],
        ARRAY['See obelisk at (1D, 2).']::text[],
        $json${"heading":"ENSMIGER (2D, 5, s) flat, white marble, 10x10 inches, poor cond, sunken","descriptor":"flat, white marble, 10x10 inches, poor cond, sunken"}$json$::jsonb
      ),
      (
        34, 37, '[MAYER]', ARRAY['MAYER']::text[], 'D', 2, 7, 'single', 'flat', 'marble', NULL::text,
        $nhg$[MAYER] (2D, 7, s) flat, white marble, 10x24 inches, illegible, sunken.$nhg$,
        NULL::text,
        ARRAY[]::integer[],
        ARRAY['Possibly part of Mayer plot, Row #3.']::text[],
        $json${"heading":"[MAYER] (2D, 7, s) flat, white marble, 10x24 inches, illegible, sunken","descriptor":"flat, white marble, 10x24 inches, illegible, sunken"}$json$::jsonb
      ),
      (
        38, 40, '[MAYER]', ARRAY['MAYER']::text[], 'D', 2, 8, 'single', 'flat', 'marble', NULL::text,
        $nhg$[MAYER] (2D, 8, s) flat, white marble, 10x24 inches, sunken "Father"$nhg$,
        $nhg$Father$nhg$,
        ARRAY[]::integer[],
        ARRAY['Possibly part of Mayer plot, Row #3.']::text[],
        $json${"heading":"[MAYER] (2D, 8, s) flat, white marble, 10x24 inches, sunken","descriptor":"flat, white marble, 10x24 inches, sunken"}$json$::jsonb
      ),
      (
        41, 44, 'MILLER', ARRAY['MILLER']::text[], 'D', 3, 1, 'single', 'upright', 'marble', 'poor',
        $nhg$MILLER (3D, 1, s) upright, white marble, poor cond, fallen, lamb"[-] Miller/ [-] / [-] 1876 / [-] / 22 Sept. 1876" CR: Middle name is Frederick$nhg$,
        $nhg$[-] Miller/ [-] / [-] 1876 / [-] / 22 Sept. 1876$nhg$,
        ARRAY[1876]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MILLER (3D, 1, s) upright, white marble, poor cond, fallen, lamb","descriptor":"upright, white marble, poor cond, fallen, lamb"}$json$::jsonb
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
    221,
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
      AND existing.source_page_number = 221
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
        'D'::varchar, 1, 3, 6, 'MAYER', ARRAY['MAYER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$MAYER (1D, 3, s) upright, gray granite, exc cond "Mother / Magd. Mayer"$nhg$,
        $nhg$Mother / Magd. Mayer$nhg$,
        ARRAY[]::integer[],
        ARRAY['Markers for stones in Row 1D are found in Row 2D.']::text[],
        $json${"heading":"MAYER (1D, 3, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        'D'::varchar, 2, 2, 20, 'WEBER/FLAEHIN', ARRAY['WEBER','FLAEHIN']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$WEBER/FLAEHIN (2D, 2, s) upright, white marble, poor cond, hand with upraised index finger "Our Mother / Anna Maria / Weber / gestorben / 20 Dec. 1896 / alter 83 jahr / 1 mo. 18 tage / [3 illegible lines]" CRG: Anna Marie Weber nee Flaehin, b. 1 November 1813 in Andienbach Kreis Pietingen Kr Hessen, married G[-] Weber, 4 children, 3 daughters and [1] son, d. 20 December 1896, buried 22 December, 83y 1m 20da$nhg$,
        $nhg$Our Mother / Anna Maria / Weber / gestorben / 20 Dec. 1896 / alter 83 jahr / 1 mo. 18 tage / [3 illegible lines]$nhg$,
        ARRAY[1813, 1896]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WEBER/FLAEHIN (2D, 2, s) upright, white marble, poor cond, hand with upraised index finger","descriptor":"upright, white marble, poor cond, hand with upraised index finger"}$json$::jsonb
      ),
      (
        'D'::varchar, 2, 6, 33, 'ENSMIGER', ARRAY['ENSMIGER']::text[], 'single', 'flat', 'marble', 'poor',
        $nhg$ENSMIGER (2D, 6, s) flat, white marble, 10x10 inches, poor cond, sunken "Philip / Ensmiger" See obelisk at (1D, 2)$nhg$,
        $nhg$Philip / Ensmiger$nhg$,
        ARRAY[]::integer[],
        ARRAY['See obelisk at (1D, 2).']::text[],
        $json${"heading":"ENSMIGER (2D, 6, s) flat, white marble, 10x10 inches, poor cond, sunken","descriptor":"flat, white marble, 10x10 inches, poor cond, sunken"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 221
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
  WHERE source_page_number = 221
    AND parsed_section_name = 'D'
    AND (
      (parsed_row_number = 1 AND parsed_position_number = 3)
      OR (parsed_row_number = 2 AND parsed_position_number BETWEEN 2 AND 8)
      OR (parsed_row_number = 3 AND parsed_position_number = 1)
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
    AND observation.observation_text IN (
      'Markers for stones in Row 1D are found in Row 2D',
      'Two plot markers, white marble',
      'Possibly part of Mayer plot, Row #3'
    )
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('D', 1, 3, 'CR', 'Church Records', 'note', 'Markers for stones in Row 1D are found in Row 2D', NULL::date, 'CR: Markers for stones in Row 1D are found in Row 2D', 'review'),
    ('D', 2, 2, 'CRG', 'Church Records in German', 'death_date', '20 December 1896', DATE '1896-12-20', 'CRG: Anna Marie Weber nee Flaehin, b. 1 November 1813 in Andienbach Kreis Pietingen Kr Hessen, married G[-] Weber, 4 children, 3 daughters and [1] son, d. 20 December 1896, buried 22 December, 83y 1m 20da', 'high'),
    ('D', 2, 2, 'CRG', 'Church Records in German', 'note', 'Anna Marie Weber nee Flaehin, b. 1 November 1813 in Andienbach Kreis Pietingen Kr Hessen, married G[-] Weber, 4 children, 3 daughters and [1] son, d. 20 December 1896, buried 22 December, 83y 1m 20da', NULL::date, 'CRG: Anna Marie Weber nee Flaehin, b. 1 November 1813 in Andienbach Kreis Pietingen Kr Hessen, married G[-] Weber, 4 children, 3 daughters and [1] son, d. 20 December 1896, buried 22 December, 83y 1m 20da', 'review'),
    ('D', 3, 1, 'CR', 'Church Records', 'middle_initial', 'Frederick', NULL::date, 'CR: Middle name is Frederick', 'review'),
    ('D', 3, 1, 'CR', 'Church Records', 'note', 'Middle name is Frederick', NULL::date, 'CR: Middle name is Frederick', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 221
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
    ('D', 1, 3, 'entry_note', 'Markers for stones in Row 1D are found in Row 2D'),
    ('D', 2, 6, 'plot_marker', 'Two plot markers, white marble'),
    ('D', 2, 7, 'entry_note', 'Possibly part of Mayer plot, Row #3'),
    ('D', 2, 8, 'entry_note', 'Possibly part of Mayer plot, Row #3')
) AS observation(parsed_section_name, parsed_row_number, parsed_position_number, observation_type, observation_text)
  ON observation.parsed_section_name = entry.parsed_section_name
 AND observation.parsed_row_number = entry.parsed_row_number
 AND observation.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 221
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 221 AND parsed_section_name = 'D' AND ((parsed_row_number = 1 AND parsed_position_number = 3) OR (parsed_row_number = 2 AND parsed_position_number IN (6, 7, 8)))) AND observation_text IN ('Markers for stones in Row 1D are found in Row 2D', 'Two plot markers, white marble', 'Possibly part of Mayer plot, Row #3');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 221 AND parsed_section_name = 'D' AND ((parsed_row_number = 1 AND parsed_position_number = 3) OR (parsed_row_number = 2 AND parsed_position_number = 2) OR (parsed_row_number = 3 AND parsed_position_number = 1))) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 221 AND parsed_section_name = 'D' AND ((parsed_row_number = 1 AND parsed_position_number = 3 AND name_text = 'MAYER') OR (parsed_row_number = 2 AND parsed_position_number IN (3, 4, 5, 7, 8)) OR (parsed_row_number = 3 AND parsed_position_number = 1));
