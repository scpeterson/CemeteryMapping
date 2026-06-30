--liquibase formatted sql

--changeset cemeterymapping:159-correct-north-hills-miller-muller-page-191
UPDATE north_hills_ocr_entries
SET
  raw_text = replace(raw_text, 'MILLER/MULLER (2B, 3, c)', 'MILLER/MÜLLER (2B, 3, c)'),
  name_text = 'MILLER/MÜLLER',
  surnames = ARRAY['MILLER', 'MÜLLER']::text[],
  source_entry = jsonb_set(source_entry, '{heading}', to_jsonb(replace(source_entry->>'heading', 'MILLER/MULLER (2B, 3, c)', 'MILLER/MÜLLER (2B, 3, c)'))),
  updated_at = now()
WHERE source_page_index = 12
  AND source_page_number = 191
  AND source_line_start = 19
  AND name_text = 'MILLER/MULLER';

--rollback UPDATE north_hills_ocr_entries SET raw_text = replace(raw_text, 'MILLER/MÜLLER (2B, 3, c)', 'MILLER/MULLER (2B, 3, c)'), name_text = 'MILLER/MULLER', surnames = ARRAY['MILLER', 'MULLER']::text[], source_entry = jsonb_set(source_entry, '{heading}', to_jsonb(replace(source_entry->>'heading', 'MILLER/MÜLLER (2B, 3, c)', 'MILLER/MULLER (2B, 3, c)'))), updated_at = now() WHERE source_page_index = 12 AND source_page_number = 191 AND source_line_start = 19 AND name_text = 'MILLER/MÜLLER';
