--liquibase formatted sql

--changeset cemeterymapping:169-repair-north-hills-page-200-age-text
UPDATE north_hills_ocr_entries
SET
  raw_text = replace(raw_text, 'Sly 4m 17da', '81y 4m 17da'),
  updated_at = now()
WHERE source_page_index = 21
  AND source_page_number = 200
  AND parsed_section_name = 'C'
  AND parsed_row_number = 3
  AND parsed_position_number = 12
  AND name_text = 'WILLS';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, 'Sly 4m 17da', '81y 4m 17da'),
  raw_text = replace(fact.raw_text, 'Sly 4m 17da', '81y 4m 17da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 21
  AND entry.source_page_number = 200
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 3
  AND entry.parsed_position_number = 12
  AND entry.name_text = 'WILLS'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = replace(raw_text, '93y llm 17da', '93y 11m 17da'),
  updated_at = now()
WHERE source_page_index = 21
  AND source_page_number = 200
  AND parsed_section_name = 'C'
  AND parsed_row_number = 3
  AND parsed_position_number = 17
  AND name_text = 'SOERGEL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '93y llm 17da', '93y 11m 17da'),
  raw_text = replace(fact.raw_text, '93y llm 17da', '93y 11m 17da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 21
  AND entry.source_page_number = 200
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 3
  AND entry.parsed_position_number = 17
  AND entry.name_text = 'SOERGEL'
  AND fact.source_code = 'CR';

--rollback UPDATE north_hills_ocr_entries SET raw_text = replace(raw_text, '81y 4m 17da', 'Sly 4m 17da'), updated_at = now() WHERE source_page_index = 21 AND source_page_number = 200 AND parsed_section_name = 'C' AND parsed_row_number = 3 AND parsed_position_number = 12 AND name_text = 'WILLS';
--rollback UPDATE north_hills_ocr_source_facts fact SET fact_value = replace(fact.fact_value, '81y 4m 17da', 'Sly 4m 17da'), raw_text = replace(fact.raw_text, '81y 4m 17da', 'Sly 4m 17da'), updated_at = now() FROM north_hills_ocr_entries entry WHERE fact.entry_id = entry.id AND entry.source_page_index = 21 AND entry.source_page_number = 200 AND entry.parsed_section_name = 'C' AND entry.parsed_row_number = 3 AND entry.parsed_position_number = 12 AND entry.name_text = 'WILLS' AND fact.source_code = 'CR';
--rollback UPDATE north_hills_ocr_entries SET raw_text = replace(raw_text, '93y 11m 17da', '93y llm 17da'), updated_at = now() WHERE source_page_index = 21 AND source_page_number = 200 AND parsed_section_name = 'C' AND parsed_row_number = 3 AND parsed_position_number = 17 AND name_text = 'SOERGEL';
--rollback UPDATE north_hills_ocr_source_facts fact SET fact_value = replace(fact.fact_value, '93y 11m 17da', '93y llm 17da'), raw_text = replace(fact.raw_text, '93y 11m 17da', '93y llm 17da'), updated_at = now() FROM north_hills_ocr_entries entry WHERE fact.entry_id = entry.id AND entry.source_page_index = 21 AND entry.source_page_number = 200 AND entry.parsed_section_name = 'C' AND entry.parsed_row_number = 3 AND entry.parsed_position_number = 17 AND entry.name_text = 'SOERGEL' AND fact.source_code = 'CR';
