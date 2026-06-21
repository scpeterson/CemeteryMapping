--liquibase formatted sql

--changeset cemeterymapping:130-correct-north-hills-hood-hamilton-name-page-199
UPDATE north_hills_ocr_entries
SET
  raw_text = replace(raw_text, 'Genevieve Hamiltoo /Hood/', 'Genevieve Hamilton /Hood/'),
  inscription_text = replace(inscription_text, 'Genevieve Hamiltoo /Hood/', 'Genevieve Hamilton /Hood/'),
  updated_at = now()
WHERE source_page_index = 20
  AND source_page_number = 199
  AND source_line_start = 41
  AND name_text = 'HOOD/HAMILTON'
  AND raw_text LIKE '%Genevieve Hamiltoo /Hood/%';

--rollback UPDATE north_hills_ocr_entries SET raw_text = replace(raw_text, 'Genevieve Hamilton /Hood/', 'Genevieve Hamiltoo /Hood/'), inscription_text = replace(inscription_text, 'Genevieve Hamilton /Hood/', 'Genevieve Hamiltoo /Hood/'), updated_at = now() WHERE source_page_index = 20 AND source_page_number = 199 AND source_line_start = 41 AND name_text = 'HOOD/HAMILTON' AND raw_text LIKE '%Genevieve Hamilton /Hood/%';
