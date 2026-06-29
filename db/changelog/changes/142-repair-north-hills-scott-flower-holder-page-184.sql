--liquibase formatted sql

--changeset cemeterymapping:142-repair-north-hills-scott-flower-holder-page-184 splitStatements:false
WITH target_entries AS (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 5
    AND source_page_number = 184
    AND source_line_start = 9
    AND name_text = 'SCOTT'
    AND raw_text ILIKE '%Flower holder with flowers%'
),
updated_entries AS (
  UPDATE north_hills_ocr_entries entry
  SET
    raw_text = E'SCOTT (3A, 1, s) pillow, orange granite, exc cond, church window, grapes, leaves "Roy C. Scott/ May 26, 1913 / Aug. 26, 1961 /Father"· CR: Middle name Charles. Councilman\nFlower holder with flowers',
    parse_notes = CASE
      WHEN COALESCE(entry.parse_notes, ARRAY[]::text[]) @> ARRAY['Italic standalone note: Flower holder with flowers; physical observation, not a burial or church-record fact.']::text[]
      THEN entry.parse_notes
      ELSE COALESCE(entry.parse_notes, ARRAY[]::text[]) || ARRAY['Italic standalone note: Flower holder with flowers; physical observation, not a burial or church-record fact.']::text[]
    END,
    updated_at = now()
  FROM target_entries
  WHERE entry.id = target_entries.id
  RETURNING entry.id
),
removed_merged_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING updated_entries
  WHERE fact.entry_id = updated_entries.id
    AND fact.source_code = 'CR'
    AND fact.fact_type = 'note'
    AND fact.fact_value = 'Middle name Charles. Councilman Flower holder with flowers'
  RETURNING fact.id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Charles. Councilman', NULL::date, 'CR: Middle name Charles. Councilman', 'review'
FROM updated_entries
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 9 AND name_text = 'SCOTT') AND source_code = 'CR' AND fact_type = 'note' AND fact_value = 'Middle name Charles. Councilman';
--rollback UPDATE north_hills_ocr_entries SET raw_text = 'SCOTT (3A, 1, s) pillow, orange granite, exc cond, church window, grapes, leaves "Roy C. Scott/ May 26, 1913 / Aug. 26, 1961 /Father"· CR: Middle name Charles. Councilman Flower holder with flowers', parse_notes = array_remove(parse_notes, 'Italic standalone note: Flower holder with flowers; physical observation, not a burial or church-record fact.'), updated_at = now() WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 9 AND name_text = 'SCOTT';
--rollback INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence) SELECT id, 'CR', 'Church Records', 'note', 'Middle name Charles. Councilman Flower holder with flowers', NULL::date, 'CR: Middle name Charles. Councilman Flower holder with flowers', 'review' FROM north_hills_ocr_entries WHERE source_page_index = 5 AND source_page_number = 184 AND source_line_start = 9 AND name_text = 'SCOTT' ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'north_hills_ocr_source_facts';
