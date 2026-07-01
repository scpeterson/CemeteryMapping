--liquibase formatted sql

--changeset cemeterymapping:172-complete-north-hills-page-202-facts
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'death_date', 'January 5, 1944', DATE '1944-01-05', 'CR: Clarence Dale Sarver, d. January 5, 1944', 'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 23
  AND source_page_number = 202
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 7
  AND name_text = 'SARVER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'October 16, 1949', DATE '1949-10-16', 'CR: Jacob A., d. October 16, 1949, 63y 28da', 'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 23
  AND source_page_number = 202
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 13
  AND name_text = 'HEINTZ'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 23 AND source_page_number = 202 AND parsed_section_name = 'C' AND parsed_row_number = 4 AND parsed_position_number IN (7,13) AND name_text IN ('SARVER','HEINTZ')) AND source_code = 'CR' AND fact_type = 'death_date' AND fact_value IN ('January 5, 1944', 'October 16, 1949');
