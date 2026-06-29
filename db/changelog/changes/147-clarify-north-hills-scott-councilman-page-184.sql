--liquibase formatted sql

--changeset cemeterymapping:147-clarify-north-hills-scott-councilman-page-184
UPDATE north_hills_ocr_entries
SET
  raw_text = E'SCOTT (3A, 1, s) pillow, orange granite, exc cond, church window, grapes, leaves "Roy C. Scott/ May 26, 1913 / Aug. 26, 1961 /Father"· CR: Middle name Charles. Church position: Councilman\nFlower holder with flowers',
  updated_at = now()
WHERE source_page_index = 5
  AND source_page_number = 184
  AND source_line_start = 9
  AND name_text = 'SCOTT';

DELETE FROM north_hills_ocr_source_facts
WHERE entry_id IN (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 5
    AND source_page_number = 184
    AND source_line_start = 9
    AND name_text = 'SCOTT'
)
AND source_code = 'CR'
AND fact_type = 'note'
AND fact_value IN (
  'Middle name Charles. Councilman',
  'Middle name Charles. Councilman Flower holder with flowers'
);

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Charles. Church position: Councilman', NULL::date, 'CR: Middle name Charles. Church position: Councilman', 'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 5
  AND source_page_number = 184
  AND source_line_start = 9
  AND name_text = 'SCOTT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Church position: Councilman', NULL::date, 'CR: Middle name Charles. Church position: Councilman', 'medium'
FROM north_hills_ocr_entries
WHERE source_page_index = 5
  AND source_page_number = 184
  AND source_line_start = 9
  AND name_text = 'SCOTT'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 9 AND name_text = 'SCOTT') AND source_code = 'CR' AND fact_type = 'note' AND fact_value IN ('Middle name Charles. Church position: Councilman', 'Church position: Councilman');
--rollback UPDATE north_hills_ocr_entries SET raw_text = E'SCOTT (3A, 1, s) pillow, orange granite, exc cond, church window, grapes, leaves "Roy C. Scott/ May 26, 1913 / Aug. 26, 1961 /Father"· CR: Middle name Charles. Councilman\nFlower holder with flowers', updated_at = now() WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 9 AND name_text = 'SCOTT';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'north_hills_ocr_source_facts';
