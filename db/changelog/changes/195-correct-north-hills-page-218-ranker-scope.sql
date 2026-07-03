--liquibase formatted sql

--changeset cemeterymapping:195-correct-north-hills-page-218-ranker-scope splitStatements:false
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$RANKER/BRUECKMAN (16C, 10, s) flat, bronze, exc cond, cross "Carol Brueckman/ Ranker / Loving wife and mother / Jul 17 1929 - May 22, 1999"$nhg$,
  source_entry = $json${"heading":"RANKER/BRUECKMAN (16C, 10, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb,
  updated_at = now()
WHERE source_page_number = 218
  AND parsed_section_name = 'C'
  AND parsed_row_number = 16
  AND parsed_position_number = 10
  AND name_text = 'RANKER/BRUECKMAN';

--rollback UPDATE north_hills_ocr_entries SET raw_text = replace(raw_text, '(16C, 10, s)', '(16C, 10, s}'), source_entry = jsonb_set(source_entry, '{heading}', to_jsonb(replace(source_entry->>'heading', '(16C, 10, s)', '(16C, 10, s}'))), updated_at = now() WHERE source_page_number = 218 AND parsed_section_name = 'C' AND parsed_row_number = 16 AND parsed_position_number = 10 AND name_text = 'RANKER/BRUECKMAN';
