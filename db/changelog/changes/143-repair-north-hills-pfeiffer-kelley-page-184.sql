--liquibase formatted sql

--changeset cemeterymapping:143-repair-north-hills-pfeiffer-kelley-page-184 splitStatements:false
WITH candidate_entries AS (
  SELECT id, batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 5
    AND source_page_number = 184
    AND source_line_start = 19
    AND name_text = 'PFEIFFER'
    AND raw_text ILIKE '%KEL%EY (3A, 4, s)%'
),
updated_pfeiffer AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = 25,
    raw_text = 'PFEIFFER (3A, 3, c) upright, gray granite, exc cond, flowers, basket-weave design "Pfeiffer / Edward G. / 1877-1967 / Edna M.  / 1887- 1963" CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"',
    marker_type_text = 'upright',
    material_text = 'granite',
    condition_text = 'excellent',
    inscription_text = 'Pfeiffer / Edward G. / 1877-1967 / Edna M.  / 1887- 1963 Dr. J. J. Myers buried / was in Florida',
    parsed_years = ARRAY[1877, 1887, 1963, 1967]::integer[],
    parse_notes = CASE
      WHEN COALESCE(entry.parse_notes, ARRAY[]::text[]) @> ARRAY['Standalone note: Gap, about 15 feet.']::text[]
      THEN entry.parse_notes
      ELSE COALESCE(entry.parse_notes, ARRAY[]::text[]) || ARRAY['Standalone note: Gap, about 15 feet.']::text[]
    END,
    source_entry = jsonb_build_object(
      'heading', 'PFEIFFER (3A, 3, c) upright, gray granite, exc cond, flowers, basket-weave design',
      'descriptor', 'upright, gray granite, exc cond, flowers, basket-weave design'
    ),
    updated_at = now()
  FROM candidate_entries
  WHERE entry.id = candidate_entries.id
  RETURNING entry.id, entry.batch_id, entry.cemetery_id
),
removed_merged_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING updated_pfeiffer
  WHERE fact.entry_id = updated_pfeiffer.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
),
inserted_pfeiffer_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"', NULL::date, 'CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"', 'review'
  FROM updated_pfeiffer
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'December 18, 1967', DATE '1967-12-18', 'CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"', 'high'
  FROM updated_pfeiffer
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'January 27, 1963', DATE '1963-01-27', 'CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"', 'high'
  FROM updated_pfeiffer
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'age_at_death', '90y 18d', NULL::date, 'CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"', 'medium'
  FROM updated_pfeiffer
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'age_at_death', '75y 3m 25d', NULL::date, 'CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"', 'medium'
  FROM updated_pfeiffer
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'note', 'Dr. J. J. Myers buried / was in Florida', NULL::date, 'CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"', 'medium'
  FROM updated_pfeiffer
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
  RETURNING id
),
new_kelley_entries AS (
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
    batch_id,
    cemetery_id,
    5,
    184,
    27,
    30,
    'KELLEY (3A, 4, s) flat, gray granite, exc cond, cross in circle "Paul S Kelley / A2C US Air Force / Vietnam / Feb:8 1940 May 17 1986" Funeral home marker: "Paul S Kelley/ 1940-1986 / Richard D. Cole Funeral Home" Separate flag holder: "Korea US / 1950-1955"',
    'KELLEY',
    ARRAY['KELLEY']::text[],
    'A',
    3,
    4,
    'single',
    'flat',
    'granite',
    'excellent',
    'Paul S Kelley / A2C US Air Force / Vietnam / Feb:8 1940 May 17 1986 Paul S Kelley/ 1940-1986 / Richard D. Cole Funeral Home Korea US / 1950-1955',
    ARRAY[1940, 1950, 1955, 1986]::integer[],
    'high',
    ARRAY['Standalone note before this entry: Gap, about 15 feet.']::text[],
    jsonb_build_object(
      'heading', 'KELLEY (3A, 4, s) flat, gray granite, exc cond, cross in circle',
      'descriptor', 'flat, gray granite, exc cond, cross in circle'
    )
  FROM updated_pfeiffer
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM new_kelley_entries;

--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 27 AND name_text = 'KELLEY';
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 19 AND name_text = 'PFEIFFER') AND source_code = 'CR';
--rollback UPDATE north_hills_ocr_entries SET parse_notes = array_remove(parse_notes, 'Standalone note: Gap, about 15 feet.'), updated_at = now() WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 19 AND name_text = 'PFEIFFER';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
