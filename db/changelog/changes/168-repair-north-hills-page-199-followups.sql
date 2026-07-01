--liquibase formatted sql

--changeset cemeterymapping:168-repair-north-hills-page-199-followups
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HUBERT (2C, 14, c) upright, gray granite, exc cond, cross, roses & leaves across top "Hubert / Regis T. / Dec. 16, 1935 / April 20, 1996" Second side is blank. Bottom of stone: "Dedicated to God and their fellow man." Small stone with engraved sprig of leaves in ground in front: "Psalm 25" Separate flag holder: "US / Veteran", star. Vase in ground$nhg$,
  inscription_text = $nhg$Hubert / Regis T. / Dec. 16, 1935 / April 20, 1996$nhg$,
  source_entry = jsonb_build_object(
    'heading', 'HUBERT (2C, 14, c) upright, gray granite, exc cond, cross, roses & leaves across top',
    'descriptor', 'upright, gray granite, exc cond, cross, roses & leaves across top'
  ),
  updated_at = now()
WHERE source_page_index = 20
  AND source_page_number = 199
  AND parsed_section_name = 'C'
  AND parsed_row_number = 2
  AND parsed_position_number = 14
  AND name_text = 'HUBERT';

WITH candidate_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 20
    AND source_page_number = 199
    AND parsed_section_name = 'C'
    AND parsed_row_number IN (2, 3)
),
inserted_pfeiffer AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id,
    cemetery_id,
    source_page_index,
    source_page_number,
    source_line_start,
    source_line_end,
    raw_text,
    name_text,
    surnames,
    parsed_section_name,
    parsed_row_number,
    parsed_position_number,
    parsed_marker_scope,
    marker_type_text,
    material_text,
    condition_text,
    inscription_text,
    parsed_years,
    parse_confidence,
    parse_notes,
    source_entry
  )
  SELECT
    candidate_batches.batch_id,
    candidate_batches.cemetery_id,
    20,
    199,
    24,
    25,
    $nhg$PFEIFFER (2C, 16, s) upright with open ledger, gray granite, exc cond, "Mary Pfeiffer / 1847-1904 / Asleep in Jesus"$nhg$,
    'PFEIFFER',
    ARRAY['PFEIFFER']::text[],
    'C',
    2,
    16,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Mary Pfeiffer / 1847-1904 / Asleep in Jesus$nhg$,
    ARRAY[1847, 1904]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object(
      'heading', 'PFEIFFER (2C, 16, s) upright with open ledger, gray granite, exc cond,',
      'descriptor', 'upright with open ledger, gray granite, exc cond'
    )
  FROM candidate_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = candidate_batches.batch_id
      AND existing.source_page_number = 199
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 2
      AND existing.parsed_position_number = 16
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_pfeiffer;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WATENPOOL (3C, 6, s) upright, gray granite, exc cond, flowers "Daughter/ Olive C. Watenpool / 1892-1935" CR: Middle name Caroline, d. December 3, 1935$nhg$,
  updated_at = now()
WHERE source_page_index = 20
  AND source_page_number = 199
  AND parsed_section_name = 'C'
  AND parsed_row_number = 3
  AND parsed_position_number = 6
  AND name_text = 'WATENPOOL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = regexp_replace(fact.fact_value, '\s*-\s*$', ''),
  raw_text = regexp_replace(fact.raw_text, '\s*-\s*$', ''),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 20
  AND entry.source_page_number = 199
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 3
  AND entry.parsed_position_number = 6
  AND entry.name_text = 'WATENPOOL'
  AND fact.source_code = 'CR'
  AND (fact.fact_value LIKE '%-' OR fact.raw_text LIKE '%-');

--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 20 AND source_page_number = 199 AND parsed_section_name = 'C' AND parsed_row_number = 2 AND parsed_position_number = 16 AND name_text = 'PFEIFFER';
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
