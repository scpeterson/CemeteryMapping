--liquibase formatted sql

--changeset cemeterymapping:144-complete-north-hills-pfeiffer-page-184-facts
INSERT INTO north_hills_ocr_source_facts (
  entry_id,
  source_code,
  source_label,
  fact_type,
  fact_value,
  fact_date,
  raw_text,
  confidence
)
SELECT
  id,
  'CR',
  'Church Records',
  'death_date',
  'January 27, 1963',
  DATE '1963-01-27',
  'CR: Edward George, d. December 18, 1967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J. Myers buried / was in Florida"',
  'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 5
  AND source_page_number = 184
  AND source_line_start = 19
  AND name_text = 'PFEIFFER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 19 AND name_text = 'PFEIFFER') AND source_code = 'CR' AND fact_type = 'death_date' AND fact_value = 'January 27, 1963';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'north_hills_ocr_source_facts';
