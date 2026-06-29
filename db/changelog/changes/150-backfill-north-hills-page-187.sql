--liquibase formatted sql

--changeset cemeterymapping:150-backfill-north-hills-page-187
UPDATE north_hills_ocr_entries
SET
  source_page_number = 187,
  parse_notes = array_remove(parse_notes, 'Printed source page number was not detected.'),
  updated_at = now()
WHERE source_page_index = 8
  AND source_page_number IS NULL;

UPDATE north_hills_ocr_entries
SET
  raw_text = regexp_replace(raw_text, '\s+Franklin\s*Park\.?\s+Borough\s+187\s+Allegheny\s+County,?\s+PA\.?$', '', 'i'),
  updated_at = now()
WHERE source_page_index = 8
  AND source_page_number = 187
  AND raw_text ~* '\s+Franklin\s*Park\.?\s+Borough\s+187\s+Allegheny\s+County,?\s+PA\.?$';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = regexp_replace(fact.fact_value, '\s+Franklin\s*Park\.?\s+Borough\s+187\s+Allegheny\s+County,?\s+PA\.?$', '', 'i'),
  raw_text = regexp_replace(fact.raw_text, '\s+Franklin\s*Park\.?\s+Borough\s+187\s+Allegheny\s+County,?\s+PA\.?$', '', 'i'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 8
  AND entry.source_page_number = 187
  AND fact.source_code = 'CR'
  AND (
    fact.fact_value ~* '\s+Franklin\s*Park\.?\s+Borough\s+187\s+Allegheny\s+County,?\s+PA\.?$'
    OR fact.raw_text ~* '\s+Franklin\s*Park\.?\s+Borough\s+187\s+Allegheny\s+County,?\s+PA\.?$'
  );

--rollback UPDATE north_hills_ocr_entries SET source_page_number = NULL, parse_notes = array_append(parse_notes, 'Printed source page number was not detected.'), updated_at = now() WHERE source_page_index = 8 AND source_page_number = 187;
--rollback DELETE FROM audit_events WHERE action = 'update' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
