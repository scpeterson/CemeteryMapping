--liquibase formatted sql

--changeset cemeterymapping:151-repair-north-hills-gibson-steele-page-187
UPDATE north_hills_ocr_entries
SET
  raw_text = 'GIBSON/STEELE (7A, 2, s) pillow, gray granite, exc cond, cross with sun behind It, flower, leaves "Mother/ Marrietta Steele / Gibson / 1898-1944" CR: d. January 21, 1944',
  updated_at = now()
WHERE source_page_number = 187
  AND source_line_start = 34
  AND name_text = 'GIBSON/STEELE';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = 'd. January 21, 1944',
  raw_text = 'CR: d. January 21, 1944',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_number = 187
  AND entry.source_line_start = 34
  AND entry.name_text = 'GIBSON/STEELE'
  AND fact.source_code = 'CR'
  AND fact.fact_type = 'note';

UPDATE north_hills_ocr_source_facts fact
SET
  raw_text = 'CR: d. January 21, 1944',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_number = 187
  AND entry.source_line_start = 34
  AND entry.name_text = 'GIBSON/STEELE'
  AND fact.source_code = 'CR'
  AND fact.fact_type = 'death_date';

--rollback UPDATE north_hills_ocr_entries SET raw_text = 'GIBSON/STEELE (7A, 2, s) pillow, gray granite, exc cond, cross with sun behind It, flower, leaves "Mother/ Marrietta Steele / Gibson / 1898-1944" CR: d. January 21, 1944 •', updated_at = now() WHERE source_page_number = 187 AND source_line_start = 34 AND name_text = 'GIBSON/STEELE';
--rollback UPDATE north_hills_ocr_source_facts fact SET fact_value = 'd. January 21, 1944 •', raw_text = 'CR: d. January 21, 1944 •', updated_at = now() FROM north_hills_ocr_entries entry WHERE fact.entry_id = entry.id AND entry.source_page_number = 187 AND entry.source_line_start = 34 AND entry.name_text = 'GIBSON/STEELE' AND fact.source_code = 'CR' AND fact.fact_type = 'note';
--rollback UPDATE north_hills_ocr_source_facts fact SET raw_text = 'CR: d. January 21, 1944 •', updated_at = now() FROM north_hills_ocr_entries entry WHERE fact.entry_id = entry.id AND entry.source_page_number = 187 AND entry.source_line_start = 34 AND entry.name_text = 'GIBSON/STEELE' AND fact.source_code = 'CR' AND fact.fact_type = 'death_date';
