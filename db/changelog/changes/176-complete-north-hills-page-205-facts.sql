--liquibase formatted sql

--changeset cemeterymapping:176-complete-north-hills-page-205-facts
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT
  entry.id,
  'CR',
  'Church Records',
  'death_date',
  'January 11, 1925',
  DATE '1925-01-11',
  'CR: Baltzar, d. January 11, 1925, 77y 7m 23da',
  'high'
FROM north_hills_ocr_entries entry
WHERE entry.source_page_index = 26
  AND entry.source_page_number = 205
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 6
  AND entry.parsed_position_number = 18
  AND entry.name_text = 'BERINGER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 26 AND source_page_number = 205 AND parsed_section_name = 'C' AND parsed_row_number = 6 AND parsed_position_number = 18 AND name_text = 'BERINGER') AND source_code = 'CR' AND fact_type = 'death_date' AND fact_value = 'January 11, 1925';
