--liquibase formatted sql

--changeset cemeterymapping:208-add-north-hills-page-227-steele-entry splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 227
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
    227,
    1,
    2,
    $nhg$STEELE/STEEL/MEHRLICH (7D, 1, s) upright, small white marble, good cond, sunken "Daughter / Lily Mae / Steele" CRG: Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of WIibert and his wife Anna nee Mehrlich, buried September 30, 8m 24da$nhg$,
    'STEELE/STEEL/MEHRLICH',
    ARRAY['STEELE','STEEL','MEHRLICH']::text[],
    'D',
    7,
    1,
    'single',
    'upright',
    'marble',
    'good',
    $nhg$Daughter / Lily Mae / Steele$nhg$,
    ARRAY[1897]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"STEELE/STEEL/MEHRLICH (7D, 1, s) upright, small white marble, good cond, sunken","descriptor":"upright, small white marble, good cond, sunken"}$json$::jsonb
  FROM page_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = page_batches.source_page_index
      AND existing.source_page_number = 227
      AND existing.parsed_section_name = 'D'
      AND existing.parsed_row_number = 7
      AND existing.parsed_position_number = 1
      AND existing.name_text = 'STEELE/STEEL/MEHRLICH'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
),
affected_entries AS (
  SELECT id
  FROM inserted_missing
  UNION
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 227
    AND parsed_section_name = 'D'
    AND parsed_row_number = 7
    AND parsed_position_number = 1
    AND name_text = 'STEELE/STEEL/MEHRLICH'
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code = 'CRG'
  RETURNING fact.id
),
removed_observations AS (
  DELETE FROM north_hills_ocr_entry_observations observation
  USING affected_entries
  WHERE observation.entry_id = affected_entries.id
    AND (
      (observation.observation_type = 'gap' AND observation.observation_text = 'Gap of 15 feet with depression.')
      OR (observation.observation_type = 'plot_marker' AND observation.observation_text IN ('Plot marker, white "P. B." before 7D, 1', 'Plot marker, white "P. B." after gap before 7D, 1'))
    )
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM inserted_missing) AS inserted_missing, (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('CRG', 'Church Records in German', 'death_date', 'September 28, 1897', DATE '1897-09-28', 'CRG: Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of WIibert and his wife Anna nee Mehrlich, buried September 30, 8m 24da', 'high'),
    ('CRG', 'Church Records in German', 'note', 'Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of WIibert and his wife Anna nee Mehrlich, buried September 30, 8m 24da', NULL::date, 'CRG: Lilly May Steel, b. June 5th 1897, d. September 28th 1897, daughter of WIibert and his wife Anna nee Mehrlich, buried September 30, 8m 24da', 'review')
) AS fact(source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON true
WHERE entry.source_page_number = 227
  AND entry.parsed_section_name = 'D'
  AND entry.parsed_row_number = 7
  AND entry.parsed_position_number = 1
  AND entry.name_text = 'STEELE/STEEL/MEHRLICH'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

INSERT INTO north_hills_ocr_entry_observations (entry_id, observation_type, observation_text, status)
SELECT entry.id, observation.observation_type, observation.observation_text, 'staged'
FROM north_hills_ocr_entries entry
CROSS JOIN (
  VALUES
    ('plot_marker', 'Plot marker, white "P. B." before 7D, 1'),
    ('gap', 'Gap of 15 feet with depression.'),
    ('plot_marker', 'Plot marker, white "P. B." after gap before 7D, 1')
) AS observation(observation_type, observation_text)
WHERE entry.source_page_number = 227
  AND entry.parsed_section_name = 'D'
  AND entry.parsed_row_number = 7
  AND entry.parsed_position_number = 1
  AND entry.name_text = 'STEELE/STEEL/MEHRLICH'
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 227 AND parsed_section_name = 'D' AND parsed_row_number = 7 AND parsed_position_number = 1 AND name_text = 'STEELE/STEEL/MEHRLICH') AND observation_text IN ('Plot marker, white "P. B." before 7D, 1', 'Gap of 15 feet with depression.', 'Plot marker, white "P. B." after gap before 7D, 1');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 227 AND parsed_section_name = 'D' AND parsed_row_number = 7 AND parsed_position_number = 1 AND name_text = 'STEELE/STEEL/MEHRLICH') AND source_code = 'CRG';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 227 AND parsed_section_name = 'D' AND parsed_row_number = 7 AND parsed_position_number = 1 AND name_text = 'STEELE/STEEL/MEHRLICH';
