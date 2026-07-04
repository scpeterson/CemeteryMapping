--liquibase formatted sql

--changeset cemeterymapping:206-repair-north-hills-page-226 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 226
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        9, 14, 'STEELE/STEEL/MEHRLICH', ARRAY['STEELE','STEEL','MEHRLICH']::text[], 7, 1, 'single', 'upright', 'marble', 'good',
        $nhg$STEELE/STEEL/MEHRLICH (7D, 1, s) upright, small white marble, good cond, sunken "Daughter / Lily Mae / Steele" CRG: Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of Wilbert and his wife Anna nee Mehrlich, buried September 30, 8m 24da$nhg$,
        $nhg$Daughter / Lily Mae / Steele$nhg$,
        ARRAY[1897]::integer[],
        ARRAY[]::text[],
        $json${"heading":"STEELE/STEEL/MEHRLICH (7D, 1, s) upright, small white marble, good cond, sunken","descriptor":"upright, small white marble, good cond, sunken"}$json$::jsonb
      ),
      (
        22, 22, 'MEHRLICH', ARRAY['MEHRLICH']::text[], 8, 1, 'single', 'upright', 'granite', 'excellent',
        $nhg$MEHRLICH (8D, 1, s)upright, gray granite, exc cond, ivy, on common base with (8D, 2) "John Mehrlich / June 13, 1833 / May 18, 1905 / Father"$nhg$,
        $nhg$John Mehrlich / June 13, 1833 / May 18, 1905 / Father$nhg$,
        ARRAY[1833, 1905]::integer[],
        ARRAY['On common base with (8D, 2).']::text[],
        $json${"heading":"MEHRLICH (8D, 1, s)upright, gray granite, exc cond, ivy, on common base with (8D, 2)","descriptor":"upright, gray granite, exc cond, ivy, on common base with (8D, 2)"}$json$::jsonb
      ),
      (
        45, 45, '[SCHARF]', ARRAY['SCHARF']::text[], 8, 5, 'single', 'upright', 'marble', NULL::varchar,
        $nhg$[SCHARF] (8D, 5, s) upright, white marble, illegible. CRG: See note with (8D, 4). Believed to be Maria Elizabeth Scharf, little daughter of George and Elizabeth, f. May 7, 1882, d. 7 May, b. 27 April 1882$nhg$,
        $nhg$$nhg$,
        ARRAY[1882]::integer[],
        ARRAY['Illegible inscription.']::text[],
        $json${"heading":"[SCHARF] (8D, 5, s) upright, white marble, illegible","descriptor":"upright, white marble, illegible"}$json$::jsonb
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
    226,
    entry_values.source_line_start,
    entry_values.source_line_end,
    entry_values.raw_text,
    entry_values.name_text,
    entry_values.surnames,
    'D',
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
      AND existing.source_page_number = 226
      AND existing.parsed_section_name = 'D'
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
    parsed_section_name = 'D',
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
        7, 2, 18, 'RICE', ARRAY['RICE']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$RICE (7D, 2, s) pillow, gray granite, exc cond "Theodore Rice / 1898- 1899" CRG: Theodur Frederick Rice, b. 16th September 1898, d. 23 rd February 1899, 5m 7da, buried 25th February$nhg$,
        $nhg$Theodore Rice / 1898- 1899$nhg$,
        ARRAY[1898, 1899]::integer[],
        ARRAY[]::text[],
        $json${"heading":"RICE (7D, 2, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        8, 4, 42, 'SCHARF', ARRAY['SCHARF']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$SCHARF (8D, 4, s) upright, white marble, poor cond, fallen, sunken "Hier ruht in Gott / Elisabetha / gattin von / George Scharf / [geboren] [-] Mai 1860 / [gestorben] 29 April 1882 / [alter] 21 Jahren / 11 mo 19 tage" CRG: Note in CRG: Mother Elizabeth died Apr 29 1882 (first wife of George). Child was born 27 April 1882, died 7 May. George marries 2nd wife Anna.) There is also a child listed as Maria Elizabeth Scharf, little daughter of George, with same birth and death dates. See (8D, 5)$nhg$,
        $nhg$Hier ruht in Gott / Elisabetha / gattin von / George Scharf / [geboren] [-] Mai 1860 / [gestorben] 29 April 1882 / [alter] 21 Jahren / 11 mo 19 tage$nhg$,
        ARRAY[1860, 1882]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHARF (8D, 4, s) upright, white marble, poor cond, fallen, sunken","descriptor":"upright, white marble, poor cond, fallen, sunken"}$json$::jsonb
      ),
      (
        8, 6, 49, 'SCHARF', ARRAY['SCHARF']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$SCHARF (8D, 6, s) upright, gray granite, exc cond "George Scharf / 1841-1918 / Father" CR: d. October 26, 1918, 78y. CRG: See note with (8D, 4)$nhg$,
        $nhg$George Scharf / 1841-1918 / Father$nhg$,
        ARRAY[1841, 1918]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHARF (8D, 6, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 226
    AND entry.parsed_section_name = 'D'
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
  WHERE source_page_number = 226
    AND parsed_section_name = 'D'
    AND (
      (parsed_row_number = 7 AND parsed_position_number IN (1, 2))
      OR (parsed_row_number = 8 AND parsed_position_number IN (3, 4, 5, 6))
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
      (observation.observation_type = 'gap' AND observation.observation_text IN ('Gap of 15 feet with depression.', 'Gap, about 15 feet.'))
      OR (observation.observation_type = 'plot_marker' AND observation.observation_text IN ('Plot marker, white "P. B." before 7D, 1', 'Plot marker, white "P. B." after gap before 7D, 1'))
    )
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (7, 1, 'CRG', 'Church Records in German', 'death_date', 'September 28, 1897', DATE '1897-09-28', 'CRG: Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of Wilbert and his wife Anna nee Mehrlich, buried September 30, 8m 24da', 'high'),
    (7, 1, 'CRG', 'Church Records in German', 'note', 'Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of Wilbert and his wife Anna nee Mehrlich, buried September 30, 8m 24da', NULL::date, 'CRG: Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of Wilbert and his wife Anna nee Mehrlich, buried September 30, 8m 24da', 'review'),
    (7, 2, 'CRG', 'Church Records in German', 'death_date', 'February 23, 1899', DATE '1899-02-23', 'CRG: Theodur Frederick Rice, b. 16th September 1898, d. 23 rd February 1899, 5m 7da, buried 25th February', 'high'),
    (7, 2, 'CRG', 'Church Records in German', 'note', 'Theodur Frederick Rice, b. 16th September 1898, d. 23 rd February 1899, 5m 7da, buried 25th February', NULL::date, 'CRG: Theodur Frederick Rice, b. 16th September 1898, d. 23 rd February 1899, 5m 7da, buried 25th February', 'review'),
    (8, 4, 'CRG', 'Church Records in German', 'death_date', 'April 29, 1882', DATE '1882-04-29', 'CRG: Note in CRG: Mother Elizabeth died Apr 29 1882 (first wife of George). Child was born 27 April 1882, died 7 May. George marries 2nd wife Anna.) There is also a child listed as Maria Elizabeth Scharf, little daughter of George, with same birth and death dates. See (8D, 5)', 'high'),
    (8, 4, 'CRG', 'Church Records in German', 'note', 'Mother Elizabeth died Apr 29 1882 (first wife of George). Child was born 27 April 1882, died 7 May. George marries 2nd wife Anna.) There is also a child listed as Maria Elizabeth Scharf, little daughter of George, with same birth and death dates. See (8D, 5)', NULL::date, 'CRG: Note in CRG: Mother Elizabeth died Apr 29 1882 (first wife of George). Child was born 27 April 1882, died 7 May. George marries 2nd wife Anna.) There is also a child listed as Maria Elizabeth Scharf, little daughter of George, with same birth and death dates. See (8D, 5)', 'review'),
    (8, 5, 'CRG', 'Church Records in German', 'death_date', 'May 7, 1882', DATE '1882-05-07', 'CRG: See note with (8D, 4). Believed to be Maria Elizabeth Scharf, little daughter of George and Elizabeth, f. May 7, 1882, d. 7 May, b. 27 April 1882', 'high'),
    (8, 5, 'CRG', 'Church Records in German', 'note', 'See note with (8D, 4). Believed to be Maria Elizabeth Scharf, little daughter of George and Elizabeth, f. May 7, 1882, d. 7 May, b. 27 April 1882', NULL::date, 'CRG: See note with (8D, 4). Believed to be Maria Elizabeth Scharf, little daughter of George and Elizabeth, f. May 7, 1882, d. 7 May, b. 27 April 1882', 'review'),
    (8, 6, 'CR', 'Church Records', 'death_date', 'October 26, 1918', DATE '1918-10-26', 'CR: d. October 26, 1918, 78y.', 'high'),
    (8, 6, 'CR', 'Church Records', 'note', 'd. October 26, 1918, 78y.', NULL::date, 'CR: d. October 26, 1918, 78y.', 'review'),
    (8, 6, 'CRG', 'Church Records in German', 'note', 'See note with (8D, 4)', NULL::date, 'CRG: See note with (8D, 4)', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 226
  AND entry.parsed_section_name = 'D'
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
    (7, 1, 'plot_marker', 'Plot marker, white "P. B." before 7D, 1'),
    (7, 1, 'gap', 'Gap of 15 feet with depression.'),
    (7, 1, 'plot_marker', 'Plot marker, white "P. B." after gap before 7D, 1'),
    (8, 3, 'gap', 'Gap, about 15 feet.')
) AS observation(parsed_row_number, parsed_position_number, observation_type, observation_text)
  ON observation.parsed_row_number = entry.parsed_row_number
 AND observation.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 226
  AND entry.parsed_section_name = 'D'
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 226 AND parsed_section_name = 'D' AND ((parsed_row_number = 7 AND parsed_position_number = 1) OR (parsed_row_number = 8 AND parsed_position_number = 3))) AND observation_text IN ('Plot marker, white "P. B." before 7D, 1', 'Gap of 15 feet with depression.', 'Plot marker, white "P. B." after gap before 7D, 1', 'Gap, about 15 feet.');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 226 AND parsed_section_name = 'D' AND ((parsed_row_number = 7 AND parsed_position_number IN (1, 2)) OR (parsed_row_number = 8 AND parsed_position_number IN (4, 5, 6)))) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 226 AND parsed_section_name = 'D' AND ((parsed_row_number = 7 AND parsed_position_number = 1) OR (parsed_row_number = 8 AND parsed_position_number IN (1, 5)));
