--liquibase formatted sql

--changeset cemeterymapping:128-cleanup-north-hills-will-cr-facts-page-199
DELETE FROM north_hills_ocr_source_facts
USING north_hills_ocr_entries entry
WHERE north_hills_ocr_source_facts.entry_id = entry.id
  AND entry.source_page_index = 20
  AND entry.source_page_number = 199
  AND entry.source_line_start = 34
  AND entry.name_text = 'WILL'
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 3
  AND entry.parsed_position_number = 3
  AND north_hills_ocr_source_facts.source_code = 'CR'
  AND north_hills_ocr_source_facts.raw_text = 'CR: Middle name Woodruff, d. August 29, 1944';

--rollback INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence) SELECT id, 'CR', 'Church Records', 'note', 'Middle name Woodruff, d. August 29, 1944', NULL::date, 'CR: Middle name Woodruff, d. August 29, 1944', 'review' FROM north_hills_ocr_entries WHERE source_page_index = 20 AND source_page_number = 199 AND source_line_start = 34 AND name_text = 'WILL' ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;
