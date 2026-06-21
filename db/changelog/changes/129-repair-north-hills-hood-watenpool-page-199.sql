--liquibase formatted sql

--changeset cemeterymapping:129-repair-north-hills-hood-watenpool-page-199
WITH candidate_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 20
    AND source_page_number = 199
    AND source_line_start = 41
    AND name_text = 'HOOD/HAMILTON'
    AND raw_text LIKE '%WATENPOOL%'
),
trimmed_hood AS (
  UPDATE north_hills_ocr_entries
  SET
    source_line_end = 43,
    raw_text = 'HOOD/HAMILTON (3C, 5, s) upright, gray granite, exc cond, flowers, cross "Genevieve Hamiltoo /Hood/ 1898-1988" CR: Sept. 1, 1898 - July 27, 1988, middle initital, L',
    inscription_text = 'Genevieve Hamiltoo /Hood/ 1898-1988',
    parsed_years = ARRAY[1898, 1988]::integer[],
    source_entry = jsonb_build_object(
      'heading', 'HOOD/HAMILTON (3C, 5, s) upright, gray granite, exc cond,',
      'descriptor', 'upright, gray granite, exc cond, flowers, cross'
    ),
    updated_at = now()
  FROM candidate_batches
  WHERE north_hills_ocr_entries.batch_id = candidate_batches.batch_id
    AND north_hills_ocr_entries.source_page_index = 20
    AND north_hills_ocr_entries.source_page_number = 199
    AND north_hills_ocr_entries.source_line_start = 41
    AND north_hills_ocr_entries.name_text = 'HOOD/HAMILTON'
    AND north_hills_ocr_entries.raw_text LIKE '%WATENPOOL%'
  RETURNING north_hills_ocr_entries.id, north_hills_ocr_entries.batch_id
),
removed_merged_facts AS (
  DELETE FROM north_hills_ocr_source_facts
  USING trimmed_hood
  WHERE north_hills_ocr_source_facts.entry_id = trimmed_hood.id
    AND north_hills_ocr_source_facts.source_code = 'CR'
    AND (
      north_hills_ocr_source_facts.raw_text LIKE '%WATENPOOL%'
      OR north_hills_ocr_source_facts.fact_date = DATE '1935-12-03'
    )
  RETURNING north_hills_ocr_source_facts.id
),
inserted_hood_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Sept. 1, 1898 - July 27, 1988, middle initital, L', NULL::date, 'CR: Sept. 1, 1898 - July 27, 1988, middle initital, L', 'review'
  FROM trimmed_hood
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'July 27, 1988', DATE '1988-07-27', 'CR: Sept. 1, 1898 - July 27, 1988, middle initital, L', 'high'
  FROM trimmed_hood
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'middle_initial', 'L', NULL::date, 'CR: Sept. 1, 1898 - July 27, 1988, middle initital, L', 'medium'
  FROM trimmed_hood
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
  RETURNING id
),
inserted_watenpool AS (
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
    45,
    47,
    'WATENPOOL (3C, 6, s) upright, gray granite, exc cond, flowers "Daughter/ Olive C. Watenpool / 1892-1935" CR: Middle name Caroline, d. December 3, 1935 -',
    'WATENPOOL',
    ARRAY['WATENPOOL']::text[],
    'C',
    3,
    6,
    'single',
    'upright',
    'granite',
    'excellent',
    'Daughter/ Olive C. Watenpool / 1892-1935',
    ARRAY[1892, 1935]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object(
      'heading', 'WATENPOOL (JC, 6, s) upright, gray granite., exc cond, flowers',
      'descriptor', 'upright, gray granite, exc cond, flowers'
    )
  FROM candidate_batches
  WHERE EXISTS (
    SELECT 1
    FROM trimmed_hood
    WHERE trimmed_hood.batch_id = candidate_batches.batch_id
  )
    AND NOT EXISTS (
      SELECT 1
      FROM north_hills_ocr_entries existing
      WHERE existing.batch_id = candidate_batches.batch_id
        AND existing.source_page_number = 199
        AND existing.parsed_section_name = 'C'
        AND existing.parsed_row_number = 3
        AND existing.parsed_position_number = 6
    )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Caroline, d. December 3, 1935 -', NULL::date, 'CR: Middle name Caroline, d. December 3, 1935 -', 'review'
FROM inserted_watenpool
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'December 3, 1935', DATE '1935-12-03', 'CR: Middle name Caroline, d. December 3, 1935 -', 'high'
FROM inserted_watenpool
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 20 AND source_page_number = 199 AND source_line_start IN (41, 45) AND name_text IN ('HOOD/HAMILTON', 'WATENPOOL')) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE name_text = 'WATENPOOL' AND source_page_index = 20 AND source_page_number = 199 AND source_line_start = 45;
