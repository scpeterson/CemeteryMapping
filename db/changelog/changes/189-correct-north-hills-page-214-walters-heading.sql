--liquibase formatted sql

--changeset cemeterymapping:189-correct-north-hills-page-214-walters-heading splitStatements:false
UPDATE north_hills_ocr_entries
SET
  raw_text = replace(raw_text, 'WALTERS/SANDROCK {13C, 17, s)', 'WALTERS/SANDROCK (13C, 17, s)'),
  source_entry = jsonb_set(
    source_entry,
    '{heading}',
    to_jsonb(replace(source_entry->>'heading', 'WALTERS/SANDROCK {13C, 17, s)', 'WALTERS/SANDROCK (13C, 17, s)'))
  ),
  updated_at = now()
WHERE source_page_number = 214
  AND parsed_section_name = 'C'
  AND parsed_row_number = 13
  AND parsed_position_number = 17
  AND name_text = 'WALTERS/SANDROCK';

--rollback DELETE FROM audit_events WHERE target_table = 'north_hills_ocr_entries';
