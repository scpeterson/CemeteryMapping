--liquibase formatted sql

--changeset cemeterymapping:170-repair-north-hills-page-201
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$NESBITT/BARTZ/PINKERTON/NESBIT (3C, 23, s) upright, pink granite, good cond "Nesbitt / Linda Bartz / 1949-1998 / Not gone, only gone before / Hugh Pinkerton / 1938 [blank]" CR: Linda Nesbit Dec. 23, 1949 - July 24, 1998$nhg$,
  name_text = 'NESBITT/BARTZ/PINKERTON/NESBIT',
  surnames = ARRAY['NESBITT','BARTZ','PINKERTON','NESBIT']::text[],
  inscription_text = $nhg$Nesbitt / Linda Bartz / 1949-1998 / Not gone, only gone before / Hugh Pinkerton / 1938 [blank]$nhg$,
  parse_notes = CASE
    WHEN parse_notes @> ARRAY['Standalone note: About 35 feet to end of row.']::text[] THEN parse_notes
    ELSE array_append(parse_notes, 'Standalone note: About 35 feet to end of row.')
  END,
  source_entry = jsonb_build_object(
    'heading', 'NESBITT/BARTZ/PINKERTON/NESBIT (3C, 23, s) upright, pink granite, good cond',
    'descriptor', 'upright, pink granite, good cond'
  ),
  updated_at = now()
WHERE source_page_index = 22
  AND source_page_number = 201
  AND parsed_section_name = 'C'
  AND parsed_row_number = 3
  AND parsed_position_number = 23
  AND name_text = 'NESBITT /BARTZ/PINKERTON/NESBIT';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, ' About 35 feet to end of row', ''),
  raw_text = replace(fact.raw_text, ' About 35 feet to end of row', ''),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 22
  AND entry.source_page_number = 201
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 3
  AND entry.parsed_position_number = 23
  AND entry.name_text = 'NESBITT/BARTZ/PINKERTON/NESBIT'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = replace(raw_text, 'Sly lm 27da', '51y 1m 27da'),
  updated_at = now()
WHERE source_page_index = 22
  AND source_page_number = 201
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 1
  AND name_text = 'SOERGEL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, 'Sly lm 27da', '51y 1m 27da'),
  raw_text = replace(fact.raw_text, 'Sly lm 27da', '51y 1m 27da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 22
  AND entry.source_page_number = 201
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 4
  AND entry.parsed_position_number = 1
  AND entry.name_text = 'SOERGEL'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HAGUE (4C, 4, s) upright, gray granite, exc cond, flower spray "Albert E. Hague / 1880-1940" CR: Middle name Emil, d. December 10, 1940, 60y 8m 28da$nhg$,
  inscription_text = $nhg$Albert E. Hague / 1880-1940$nhg$,
  updated_at = now()
WHERE source_page_index = 22
  AND source_page_number = 201
  AND parsed_section_name = 'C'
  AND parsed_row_number = 4
  AND parsed_position_number = 4
  AND name_text = 'HAGUE';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(replace(replace(fact.fact_value, '60y Sm 28 da', '60y 8m 28da'), ' franklin Park Borough 201 Allegheny County, PA', ''), ' Franklin Park Borough 201 Allegheny County, PA', ''),
  raw_text = replace(replace(replace(fact.raw_text, '60y Sm 28 da', '60y 8m 28da'), ' franklin Park Borough 201 Allegheny County, PA', ''), ' Franklin Park Borough 201 Allegheny County, PA', ''),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 22
  AND entry.source_page_number = 201
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 4
  AND entry.parsed_position_number = 4
  AND entry.name_text = 'HAGUE'
  AND fact.source_code = 'CR';

--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
