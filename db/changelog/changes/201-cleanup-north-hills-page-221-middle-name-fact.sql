--liquibase formatted sql

--changeset cemeterymapping:201-cleanup-north-hills-page-221-middle-name-fact
DELETE FROM north_hills_ocr_source_facts fact
USING north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_number = 221
  AND entry.parsed_section_name = 'D'
  AND entry.parsed_row_number = 3
  AND entry.parsed_position_number = 1
  AND entry.name_text = 'MILLER'
  AND fact.source_code = 'CR'
  AND fact.fact_type = 'middle_initial'
  AND fact.fact_value = 'Frederick';

--rollback INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence) SELECT id, 'CR', 'Church Records', 'middle_initial', 'Frederick', 'CR: Middle name is Frederick', 'review' FROM north_hills_ocr_entries WHERE source_page_number = 221 AND parsed_section_name = 'D' AND parsed_row_number = 3 AND parsed_position_number = 1 AND name_text = 'MILLER' ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;
