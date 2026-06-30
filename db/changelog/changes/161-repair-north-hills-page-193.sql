--liquibase formatted sql

--changeset cemeterymapping:161-repair-north-hills-page-193
UPDATE north_hills_ocr_entries
SET
  source_line_end = 13,
  raw_text = $nhg$PFEIFFER/PFEIFER (3B, 1, c) upright, gray granite, exc cond, flower, leaves, lattice "Pfeiffer / Jacob/ 1858-1954 / Father / Pauline A. / 1863-1945 / Mother" On base: "Rock of Ages" in circle. On back: "Pfeiffer" CR: Jacob, d. July 22, 1954. Mrs. Jacob Pfeifer (Pauline), d. October 11, 1945$nhg$,
  inscription_text = $nhg$Pfeiffer / Jacob/ 1858-1954 / Father / Pauline A. / 1863-1945 / Mother$nhg$,
  parsed_years = ARRAY[1858, 1863, 1945, 1954]::integer[],
  source_entry = jsonb_build_object('heading', 'PFEIFFER/PFEIFER (3B, 1, c) upright, gray granite, exc cond, flower, leaves, lattice', 'descriptor', 'upright, gray granite, exc cond, flower, leaves, lattice'),
  updated_at = now()
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 8
  AND name_text = 'PFEIFFER/PFEIFER';

DELETE FROM north_hills_ocr_source_facts fact
USING north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 14
  AND entry.source_page_number = 193
  AND entry.source_line_start = 8
  AND entry.name_text = 'PFEIFFER/PFEIFER'
  AND fact.source_code = 'CR';

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'death_date',
  'July 22, 1954',
  DATE '1954-07-22',
  'CR: Jacob, d. July 22, 1954. Mrs. Jacob Pfeifer (Pauline), d. October 11, 1945',
  'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 8
  AND name_text = 'PFEIFFER/PFEIFER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'death_date',
  'October 11, 1945',
  DATE '1945-10-11',
  'CR: Jacob, d. July 22, 1954. Mrs. Jacob Pfeifer (Pauline), d. October 11, 1945',
  'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 8
  AND name_text = 'PFEIFFER/PFEIFER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'note',
  'Jacob, d. July 22, 1954. Mrs. Jacob Pfeifer (Pauline), d. October 11, 1945',
  'CR: Jacob, d. July 22, 1954. Mrs. Jacob Pfeifer (Pauline), d. October 11, 1945',
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 8
  AND name_text = 'PFEIFFER/PFEIFER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH page_193_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 14
    AND source_page_number = 193
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  193,
  14,
  15,
  $nhg$PFEIFFER (3B, 2, s) upright, gray granite, exc cond, palm leaf "Howard E. / Pfeiffer / 1903-1905"$nhg$,
  'PFEIFFER',
  ARRAY['PFEIFFER']::text[],
  'B',
  3,
  2,
  'single',
  'upright',
  'granite',
  'excellent',
  $nhg$Howard E. / Pfeiffer / 1903-1905$nhg$,
  ARRAY[1903, 1905]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'PFEIFFER (3B, 2, s) upright, gray granite, exc cond, palm leaf', 'descriptor', 'upright, gray granite, exc cond, palm leaf')
FROM page_193_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$PFEIFFER (3B, 5, s) upright, gray granite, exc cond ''Gotlieb Pfeiffer / May 21, 1821 / Feb. 25, 1889 / Father" CRG: Gottlieb Pfeifer b. 21 May in Lautbomsar Kussel (Rhein Baiern), f. February 27, 1889, d. 25 February, age 67y 9m 4d$nhg$,
  inscription_text = $nhg$Gotlieb Pfeiffer / May 21, 1821 / Feb. 25, 1889 / Father$nhg$,
  parsed_years = ARRAY[1821, 1889]::integer[],
  source_entry = jsonb_build_object('heading', 'PFEIFFER (3B, 5, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 23
  AND name_text = 'PFEIFFER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = 'Gottlieb Pfeifer b. 21 May in Lautbomsar Kussel (Rhein Baiern), f. February 27, 1889, d. 25 February, age 67y 9m 4d',
  raw_text = 'CRG: Gottlieb Pfeifer b. 21 May in Lautbomsar Kussel (Rhein Baiern), f. February 27, 1889, d. 25 February, age 67y 9m 4d',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 14
  AND entry.source_page_number = 193
  AND entry.source_line_start = 23
  AND entry.name_text = 'PFEIFFER'
  AND fact.source_code = 'CRG';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$PFEIFFER (3B, 6, s) upright, gray granite, exc cond "Anna Dorothea/ wife of / Gotlieb Pfeiffer / Aug. 12, 1816 / Mar, 7, 1888 / Wife"$nhg$,
  inscription_text = $nhg$Anna Dorothea/ wife of / Gotlieb Pfeiffer / Aug. 12, 1816 / Mar, 7, 1888 / Wife$nhg$,
  parsed_years = ARRAY[1816, 1888]::integer[],
  source_entry = jsonb_build_object('heading', 'PFEIFFER (3B, 6, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 28
  AND name_text = 'PFEIFFER';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 35,
  raw_text = $nhg$PFEIFFER/SCHULZ (3B, 7, s) upright, gray granite, exc cond "Caroline M. Schulz/ wife of / John Pfeiffer / Oct. 28, 1854 / Oct. 21, 1879 / Mother / In labour and in love allied, / In death they here sleep side by side / Resting in peace - the aged twain - / Till Christ shall raise them up again"$nhg$,
  inscription_text = $nhg$Caroline M. Schulz/ wife of / John Pfeiffer / Oct. 28, 1854 / Oct. 21, 1879 / Mother / In labour and in love allied, / In death they here sleep side by side / Resting in peace - the aged twain - / Till Christ shall raise them up again$nhg$,
  parsed_years = ARRAY[1854, 1879]::integer[],
  source_entry = jsonb_build_object('heading', 'PFEIFFER/SCHULZ (3B, 7, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 31
  AND name_text = 'PFEIFFER/SCHULZ';

DELETE FROM north_hills_ocr_source_facts fact
USING north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 14
  AND entry.source_page_number = 193
  AND entry.source_line_start = 31
  AND entry.name_text = 'PFEIFFER/SCHULZ'
  AND fact.source_code = 'CRG';

WITH page_193_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 14
    AND source_page_number = 193
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  193,
  37,
  40,
  $nhg$PFEIFFER/BRANDT (3B, 8, c) upright, gray granite, exc cond, scrolls "Pfeiffer/ George/ 18,51-1887 / Regina, / 1853-1930" CRG: Geo., f. December 10, 1887, age 36y, 9m, 15d. CR: Regina Brandt Pfeiffer, d. September 8, 1930, 77y 7m 5da$nhg$,
  'PFEIFFER/BRANDT',
  ARRAY['PFEIFFER', 'BRANDT']::text[],
  'B',
  3,
  8,
  'couple',
  'upright',
  'granite',
  'excellent',
  $nhg$Pfeiffer/ George/ 18,51-1887 / Regina, / 1853-1930$nhg$,
  ARRAY[1851, 1853, 1887, 1930]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'PFEIFFER/BRANDT (3B, 8, c) upright, gray granite, exc cond, scrolls', 'descriptor', 'upright, gray granite, exc cond, scrolls')
FROM page_193_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CRG',
  'Church Records in German',
  'note',
  'Geo., f. December 10, 1887, age 36y, 9m, 15d',
  'CRG: Geo., f. December 10, 1887, age 36y, 9m, 15d.',
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 37
  AND name_text = 'PFEIFFER/BRANDT'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'death_date',
  'September 8, 1930',
  DATE '1930-09-08',
  'CR: Regina Brandt Pfeiffer, d. September 8, 1930, 77y 7m 5da',
  'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 37
  AND name_text = 'PFEIFFER/BRANDT'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'note',
  'Regina Brandt Pfeiffer, d. September 8, 1930, 77y 7m 5da',
  'CR: Regina Brandt Pfeiffer, d. September 8, 1930, 77y 7m 5da',
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 37
  AND name_text = 'PFEIFFER/BRANDT'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$ROBINSON/PFEIFFER (3B, 9, s) upright, gray granite, exc cond, picket fence, leaves, scrolls "Amanda Pfeiffer / Robinson / 1876-1960" CR: d. February 22, 1960, 84y 1m 7da$nhg$,
  inscription_text = $nhg$Amanda Pfeiffer / Robinson / 1876-1960$nhg$,
  source_entry = jsonb_build_object('heading', 'ROBINSON/PFEIFFER (3B, 9, s) upright, gray granite, exc cond, picket fence, leaves, scrolls', 'descriptor', 'upright, gray granite, exc cond, picket fence, leaves, scrolls'),
  updated_at = now()
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 42
  AND name_text = 'ROBINSON/PFEIFFER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '84y lm 7da', '84y 1m 7da'),
  raw_text = replace(fact.raw_text, '84y lm 7da', '84y 1m 7da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 14
  AND entry.source_page_number = 193
  AND entry.source_line_start = 42
  AND entry.name_text = 'ROBINSON/PFEIFFER'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$PFEIFFER (3B, 10, s) upright, gray granite, exc cond, picket fence, leaves, scrolls "Albert F. Pfeiffer / 1882-1963" CR: d. November 15, 1963, 81y 1m 16da. Lived with Ernest$nhg$,
  inscription_text = $nhg$Albert F. Pfeiffer / 1882-1963$nhg$,
  source_entry = jsonb_build_object('heading', 'PFEIFFER (3B, 10, s) upright, gray granite, exc cond, picket fence, leaves, scrolls', 'descriptor', 'upright, gray granite, exc cond, picket fence, leaves, scrolls'),
  updated_at = now()
WHERE source_page_index = 14
  AND source_page_number = 193
  AND source_line_start = 46
  AND name_text = 'PFEIFFER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(replace(fact.fact_value, 'Bly lm 16da', '81y 1m 16da'), '. ,Lived', '. Lived'),
  raw_text = replace(replace(fact.raw_text, 'Bly lm 16da', '81y 1m 16da'), '. ,Lived', '. Lived'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 14
  AND entry.source_page_number = 193
  AND entry.source_line_start = 46
  AND entry.name_text = 'PFEIFFER'
  AND fact.source_code = 'CR';

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 14 AND source_page_number = 193 AND source_line_start IN (14, 37));
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 14 AND source_page_number = 193 AND source_line_start IN (14, 37);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
