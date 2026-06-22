--liquibase formatted sql

--changeset cemeterymapping:135-complete-north-hills-watenpool-page-200-facts splitStatements:false
WITH page_200_entries AS (
  SELECT id, name_text, source_line_start
  FROM north_hills_ocr_entries
  WHERE source_page_index = 21
    AND source_page_number = 200
    AND source_line_start IN (3, 9, 11, 14, 17)
    AND name_text IN ('WATENPOOL', 'DAVIS', 'WILLS', 'WISKEMAN', 'WISKEMAN/WHISKEMAN')
),
updated_headings AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_entry = entry.source_entry || jsonb_build_object(
      'heading',
      CASE entry.name_text
        WHEN 'WATENPOOL' THEN 'WATENPOOL (3C, 7, c) upright, gray, exc cond, flowers'
        WHEN 'DAVIS' THEN 'DAVIS (3C, 8, s) pillow, pink granite, exc cond, flowers, scroll'
        WHEN 'WILLS' THEN 'WILLS (3C, 9, s) upright, gray granite, exc cond'
        WHEN 'WISKEMAN' THEN 'WISKEMAN (3C, 10, s) upright, gray granite, exc cond'
        WHEN 'WISKEMAN/WHISKEMAN' THEN 'WISKEMAN/WHISKEMAN (3C, 11, s) upright, gray granite, exc cond'
        ELSE entry.source_entry ->> 'heading'
      END
    ),
    updated_at = now()
  FROM page_200_entries
  WHERE entry.id = page_200_entries.id
  RETURNING entry.id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'death_date',
  'September 29, 1939',
  DATE '1939-09-29',
  'CR: Peter, d. September 29, 1939. Anna Amelia, d. January 19, 1956, 87y 7m 27da',
  'high'
FROM page_200_entries
WHERE name_text = 'WATENPOOL'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 21 AND source_page_number = 200 AND source_line_start = 3 AND name_text = 'WATENPOOL') AND source_code = 'CR' AND fact_type = 'death_date' AND fact_value = 'September 29, 1939';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'north_hills_ocr_source_facts';
