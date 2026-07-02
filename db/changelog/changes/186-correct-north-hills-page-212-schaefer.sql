--liquibase formatted sql

--changeset cemeterymapping:186-correct-north-hills-page-212-schaefer splitStatements:false
UPDATE north_hills_ocr_entries
SET
  source_line_end = 39,
  raw_text = $nhg$SCHAEFER (13C, 2, s) upright, gray granite, exc cond, tulips, leaves "C. William G. Schaefer, M. D. / October 27, 1902 / March 8, 1970" On back: "Schaefer" Bronze vase in front of stone$nhg$,
  name_text = 'SCHAEFER',
  surnames = ARRAY['SCHAEFER']::text[],
  parsed_section_name = 'C',
  parsed_row_number = 13,
  parsed_position_number = 2,
  parsed_marker_scope = 'single',
  marker_type_text = 'upright',
  material_text = 'granite',
  condition_text = 'excellent',
  inscription_text = $nhg$C. William G. Schaefer, M. D. / October 27, 1902 / March 8, 1970 Schaefer$nhg$,
  parsed_years = ARRAY[1902, 1970]::integer[],
  parse_confidence = 'high',
  parse_notes = ARRAY[]::text[],
  source_entry = $json${"heading":"SCHAEFER (13C, 2, s) upright, gray granite, exc cond, tulips, leaves","descriptor":"upright, gray granite, exc cond, tulips, leaves"}$json$::jsonb,
  updated_at = now()
WHERE source_page_number = 212
  AND parsed_section_name = 'C'
  AND parsed_row_number = 13
  AND parsed_position_number = 2
  AND name_text = 'SCHAEFER';

--rollback DELETE FROM audit_events WHERE target_table = 'north_hills_ocr_entries';
