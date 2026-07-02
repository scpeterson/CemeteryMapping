--liquibase formatted sql

--changeset cemeterymapping:177-repair-north-hills-page-206 splitStatements:false
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SCHARF/HAYS (7C, 3, c) flat, red granite, exc cond, lilac, rose "Edward C. / May 14, 1900 / July 11, 1980 / Son / Glenn S. / Scharf / Jan. 1, 1932 / Nov. 11, 1998 / Katherine A. / June 10, 1900 / Feb. 11, 1975" CR: Mrs. Katherine Hays Scharf$nhg$,
  inscription_text = $nhg$Edward C. / May 14, 1900 / July 11, 1980 / Son / Glenn S. / Scharf / Jan. 1, 1932 / Nov. 11, 1998 / Katherine A. / June 10, 1900 / Feb. 11, 1975$nhg$,
  parsed_years = ARRAY[1900, 1932, 1975, 1980, 1998]::integer[],
  source_entry = jsonb_build_object('heading', 'SCHARF/HAYS (7C, 3, c) flat, red granite, exc cond, lilac, rose', 'descriptor', 'flat, red granite, exc cond, lilac, rose'),
  updated_at = now()
WHERE source_page_index = 27
  AND source_page_number = 206
  AND parsed_section_name = 'C'
  AND parsed_row_number = 7
  AND parsed_position_number = 3
  AND name_text = 'SCHARF/HAYS';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HAGUE/HAGUR/SKILES (7C, 11, c) upright, gray granite, exc cond, lilies "H / Edward G. Hague / 1874-1923 / Amelia, his wife / 1877- 1915" CR: Edward George Hagur, d. August 14, 1923, 48y 5m 4da. Amelia Skiles, d. October 27, 1915$nhg$,
  inscription_text = $nhg$H / Edward G. Hague / 1874-1923 / Amelia, his wife / 1877- 1915$nhg$,
  updated_at = now()
WHERE source_page_index = 27
  AND source_page_number = 206
  AND parsed_section_name = 'C'
  AND parsed_row_number = 7
  AND parsed_position_number = 11
  AND name_text = 'HAGUE/HAGUR/SKILES';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '48y Sm 4da', '48y 5m 4da'),
  raw_text = replace(fact.raw_text, '48y Sm 4da', '48y 5m 4da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 27
  AND entry.source_page_number = 206
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 7
  AND entry.parsed_position_number = 11
  AND entry.name_text = 'HAGUE/HAGUR/SKILES'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$DERSTINE (7C, 12, s) flat, bronze, exc cond, cross "John E. Derstine / T Sgt US Army / World War II / July 20 1919 - Aug 25 1997" Separate flag holder: "1941 World War II 1942", eagle. Six inch Celtic cross by stone$nhg$,
  inscription_text = $nhg$John E. Derstine / T Sgt US Army / World War II / July 20 1919 - Aug 25 1997$nhg$,
  parsed_years = ARRAY[1919, 1941, 1942, 1997]::integer[],
  updated_at = now()
WHERE source_page_index = 27
  AND source_page_number = 206
  AND parsed_section_name = 'C'
  AND parsed_row_number = 7
  AND parsed_position_number = 12
  AND name_text = 'DERSTINE';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$DERSTINE (7C, 13, s) flat, bronze, exc cond "Elizabeth S. Derstine / Beloved wife Mother / Grandmother and Greatgrandmother / June 11, 1920 - Mar.23, 2005" Tombstone is at foot of (7C, 12) grave$nhg$,
  inscription_text = $nhg$Elizabeth S. Derstine / Beloved wife Mother / Grandmother and Greatgrandmother / June 11, 1920 - Mar.23, 2005$nhg$,
  parsed_years = ARRAY[1920, 2005]::integer[],
  updated_at = now()
WHERE source_page_index = 27
  AND source_page_number = 206
  AND parsed_section_name = 'C'
  AND parsed_row_number = 7
  AND parsed_position_number = 13
  AND name_text = 'DERSTINE';

--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
