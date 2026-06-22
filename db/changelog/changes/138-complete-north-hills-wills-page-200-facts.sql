--liquibase formatted sql

--changeset cemeterymapping:138-complete-north-hills-wills-page-200-facts splitStatements:false
WITH page_entries AS (
  SELECT id, name_text, source_line_start
  FROM north_hills_ocr_entries
  WHERE source_page_index = 21
    AND source_page_number = 200
    AND source_line_start IN (23, 27, 31)
    AND name_text IN ('WILLS', 'WILLS/BROERMAN/WILL')
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'death_date', 'June 29, 1956', DATE '1956-06-29', 'CR: Middle name Henry, d. June 29, 1956, Sly 4m 17da', 'high'
FROM page_entries
WHERE source_line_start = 23
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. December 18, 1927', NULL::date, 'CR: d. December 18, 1927', 'review'
FROM page_entries
WHERE source_line_start = 27
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'December 18, 1927', DATE '1927-12-18', 'CR: d. December 18, 1927', 'high'
FROM page_entries
WHERE source_line_start = 27
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', NULL::date, 'CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', 'review'
FROM page_entries
WHERE source_line_start = 31
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 28, 1926', DATE '1926-05-28', 'CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', 'high'
FROM page_entries
WHERE source_line_start = 31
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'April 19, 1920', DATE '1920-04-19', 'CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920', 'high'
FROM page_entries
WHERE source_line_start = 31
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 21 AND source_page_number = 200 AND source_line_start IN (23, 27, 31) AND name_text IN ('WILLS', 'WILLS/BROERMAN/WILL')) AND source_code = 'CR' AND fact_type = 'death_date' AND fact_value IN ('June 29, 1956', 'December 18, 1927', 'May 28, 1926', 'April 19, 1920');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 21 AND source_page_number = 200 AND source_line_start IN (27, 31) AND name_text IN ('WILLS', 'WILLS/BROERMAN/WILL')) AND source_code = 'CR' AND fact_type = 'note' AND fact_value IN ('d. December 18, 1927', 'Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'north_hills_ocr_source_facts';
