--liquibase formatted sql

--changeset cemeterymapping:167-repair-north-hills-page-198
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WATENPOOL (2C, 3, s) upright, gray granite, exc cond, flower, scroll "William A. Watenpool / 1890-1960 / Father" CR: d. December 25, 1960, 70y 11m 10da$nhg$,
  inscription_text = $nhg$William A. Watenpool / 1890-1960 / Father$nhg$,
  source_entry = jsonb_build_object('heading', 'WATENPOOL (2C, 3, s) upright, gray granite, exc cond, flower, scroll', 'descriptor', 'upright, gray granite, exc cond, flower, scroll'),
  updated_at = now()
WHERE source_page_index = 19
  AND source_page_number = 198
  AND source_line_start = 7
  AND name_text = 'WATENPOOL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(replace(fact.fact_value, '1lm', '11m'), 'l0da', '10da'),
  raw_text = replace(replace(fact.raw_text, '1lm', '11m'), 'l0da', '10da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 19
  AND entry.source_page_number = 198
  AND entry.source_line_start = 7
  AND entry.name_text = 'WATENPOOL'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HEIN (2C, 6, c) upright, gray granite, exc cond, flowers, leaves "Hein / Michael J. / 1876-1954 /Father/ Mathilda K. / 1874-1956 / Mother'' On base: "Rock of Ages" In circle. On back: "Hein"$nhg$,
  inscription_text = $nhg$Hein / Michael J. / 1876-1954 /Father/ Mathilda K. / 1874-1956 / Mother'' On base: In circle. On back:$nhg$,
  parse_notes = ARRAY['Printed source page number was not detected.', 'Plot marker "H"']::text[],
  updated_at = now()
WHERE source_page_index = 19
  AND source_page_number = 198
  AND source_line_start = 18
  AND name_text = 'HEIN';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HIEBER (2C, 10, s) pillow, gray granite, exc cond, flowers, leaves "Bertha L. Hieber / 1903-1975"$nhg$,
  inscription_text = $nhg$Bertha L. Hieber / 1903-1975$nhg$,
  updated_at = now()
WHERE source_page_index = 19
  AND source_page_number = 198
  AND source_line_start = 37
  AND name_text = 'HIEBER';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$FOWLER (2C, 13, c) upright, gray granite, exc cond "Fowler/ Chester J. / 1893-1981 / Helen E. / 1897-1973" CR: Chester, d. May 23, 1981, 87y 5m 25da$nhg$,
  updated_at = now()
WHERE source_page_index = 19
  AND source_page_number = 198
  AND source_line_start = 47
  AND name_text = 'FOWLER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(replace(fact.fact_value, 'May 23, '' 1981', 'May 23, 1981'), '5m_25da', '5m 25da'),
  raw_text = replace(replace(fact.raw_text, 'May 23, '' 1981', 'May 23, 1981'), '5m_25da', '5m 25da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 19
  AND entry.source_page_number = 198
  AND entry.source_line_start = 47
  AND entry.name_text = 'FOWLER'
  AND fact.source_code = 'CR';

--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
