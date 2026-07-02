--liquibase formatted sql

--changeset cemeterymapping:178-correct-north-hills-page-206-dunbar
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$DUNBAR (7C, 5, s) upright, gray granite, exc cond, flower, leaves ''George R. Dunbar/ Sept. 5, 1872 / Feb. 29, 1932"$nhg$,
  source_entry = jsonb_build_object('heading', 'DUNBAR (7C, 5, s) upright, gray granite, exc cond, flower, leaves', 'descriptor', 'upright, gray granite, exc cond, flower, leaves'),
  updated_at = now()
WHERE source_page_index = 27
  AND source_page_number = 206
  AND parsed_section_name = 'C'
  AND parsed_row_number = 7
  AND parsed_position_number = 5
  AND name_text = 'DUNBAR';

--rollback DELETE FROM audit_events WHERE target_table = 'north_hills_ocr_entries';
