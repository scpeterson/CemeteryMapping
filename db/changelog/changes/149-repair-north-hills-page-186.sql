--liquibase formatted sql

--changeset cemeterymapping:149-repair-north-hills-page-186
UPDATE north_hills_ocr_entries
SET
  raw_text = 'CREA (5A, 2, s) upright, gray granite, exc cond, wild roses "James H. Crea / 1889-1963" Separate flag holder: "World War / US / 1917- 1918", star. On common base with (5A, 3)',
  inscription_text = 'James H. Crea / 1889-1963 World War / US / 1917- 1918',
  source_entry = jsonb_build_object('heading', 'CREA (5A, 2, s) upright, gray granite, exc cond, wild roses', 'descriptor', 'upright, gray granite, exc cond, wild roses'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 5 AND name_text = 'CREA';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'CREA/ PFEIFFER (5A, 3, s) upright, gray granite, exc cond, wild roses "Ella R. Pfeiffer/ wife of / James H. Crea / 1886-1962" On common base with (5A, 2). CR: d. May 16, 1962, 76y 1m 26da. Doc & Ernie''s sister',
  inscription_text = 'Ella R. Pfeiffer/ wife of / James H. Crea / 1886-1962',
  source_entry = jsonb_build_object('heading', 'CREA/ PFEIFFER (5A, 3, s) upright, gray granite, exc cond, wild roses', 'descriptor', 'upright, gray granite, exc cond, wild roses'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 9 AND name_text = 'CREA/ PFEIFFER';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'PFEIFFER (5A, 4, s) upright, gray granite, exc cond, wild roses "Ernest W. Pfeiffer / 1888-1967 / Pvt. Co. A, 125 Regt. Engrs. / World War I" Separate flag holder:" World War Veteran / US / 1917-1918", star CR: Middle name Walter, d. May 4, 1967, 79y 2m 10da',
  inscription_text = 'Ernest W. Pfeiffer / 1888-1967 / Pvt. Co. A, 125 Regt. Engrs. / World War I World War Veteran / US / 1917-1918',
  source_entry = jsonb_build_object('heading', 'PFEIFFER (5A, 4, s) upright, gray granite, exc cond, wild roses', 'descriptor', 'upright, gray granite, exc cond, wild roses'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 14 AND name_text = 'PFEIFFER';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'SCHNABEL (5A, 5, c) upright, gray granite, exc cond, wild roses "Schnabel / Philip / 1865-1949 / Father / Nettie / 1868-196 7 / Mother" CR: Philip Jr., d. July 30, 1949, 84y 4m 22da. Nettie M., d. April 2, 1967, 99y 3m 6da',
  inscription_text = 'Schnabel / Philip / 1865-1949 / Father / Nettie / 1868-196 7 / Mother',
  source_entry = jsonb_build_object('heading', 'SCHNABEL (5A, 5, c) upright, gray granite, exc cond, wild roses', 'descriptor', 'upright, gray granite, exc cond, wild roses'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 21 AND name_text = 'SCHNABEL';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BRANT (5A, 6, s) upright, gray granite, exc cond, ornate lilies "Henry Brant/ 1843-1924 / Co. I 78, Regt. P. V. I./ At rest" Separate flag holder: "GAR/ 1861 / 1865", star CR: d. February 12, 1924, 80y Sm 30da. SK: Co I 78, Regt. PVT',
  inscription_text = 'Henry Brant/ 1843-1924 / Co. I 78, Regt. P. V. I./ At rest GAR/ 1861 / 1865',
  source_entry = jsonb_build_object('heading', 'BRANT (5A, 6, s) upright, gray granite, exc cond, ornate lilies', 'descriptor', 'upright, gray granite, exc cond, ornate lilies'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 28 AND name_text = 'BRANT';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BRANT (5A, 7, s) upright, gray granite, exc cond, ornate lilies "Fannie Brant / 1841-1928 / At rest"',
  inscription_text = 'Fannie Brant / 1841-1928 / At rest',
  source_entry = jsonb_build_object('heading', 'BRANT (5A, 7, s) upright, gray granite, exc cond, ornate lilies', 'descriptor', 'upright, gray granite, exc cond, ornate lilies'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 33 AND name_text = 'BRANT';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'SCOTT (6A, 1, c) upright, pink granite, exc cond, flowers "Scott/ Freeman P. / 1915-2001 / Sgt. U.S. Army W.W. II/ Beulah M. / 1918-1993" On back: "Scott" Separate flag holder: "World War II Veteran", spread eagle CR: Freeman, middle name Paul, Oct. 22, 1915 - May 24, 2001. Beulah, Jan. 17, 1918 - March 3, 1993',
  inscription_text = 'Scott/ Freeman P. / 1915-2001 / Sgt. U.S. Army W.W. II/ Beulah M. / 1918-1993 Scott World War II Veteran',
  source_entry = jsonb_build_object('heading', 'SCOTT (6A, 1, c) upright, pink granite, exc cond, flowers', 'descriptor', 'upright, pink granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 39 AND name_text = 'SCOTT';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 47,
  raw_text = 'SCOTT (6A, 2, s) pillow, pink granite, exc cond, flowers "Son / Robert G. Scott / 1938-1941" CR: Middle name George, May 19, 1938; buried March 10, 1941, 2y 9m+',
  inscription_text = 'Son / Robert G. Scott / 1938-1941',
  parsed_years = ARRAY[1938, 1941]::integer[],
  source_entry = jsonb_build_object('heading', 'SCOTT (6A, 2, s) pillow, pink granite, exc cond, flowers', 'descriptor', 'pillow, pink granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 45 AND name_text = 'SCOTT';

DELETE FROM north_hills_ocr_source_facts
WHERE entry_id IN (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 7
    AND source_page_number = 186
    AND source_line_start IN (9, 14, 21, 28, 39, 45, 49)
)
AND source_code = 'CR';

INSERT INTO north_hills_ocr_entries (
  batch_id,
  cemetery_id,
  source_page_index,
  source_page_number,
  source_line_start,
  source_line_end,
  raw_text,
  name_text,
  surnames,
  parsed_section_name,
  parsed_row_number,
  parsed_position_number,
  parsed_marker_scope,
  marker_type_text,
  material_text,
  condition_text,
  inscription_text,
  parsed_years,
  parse_confidence,
  parse_notes,
  source_entry
)
SELECT
  source.batch_id,
  source.cemetery_id,
  7,
  186,
  49,
  51,
  'SCOTT (6A, 3, s) flat, bronze, exc cond, leaves, acorns, urn "H. Duane Scott, Jr./ Feb 26, 1947 - Oct 30, 1978" CR: Harold, disappeared July 27, 1978. Date of death is date body was found.',
  'SCOTT',
  ARRAY['SCOTT']::text[],
  'A',
  6,
  3,
  'single',
  'flat',
  'bronze',
  'excellent',
  'H. Duane Scott, Jr./ Feb 26, 1947 - Oct 30, 1978',
  ARRAY[1947, 1978]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'SCOTT (6A, 3, s) flat, bronze, exc cond, leaves, acorns, urn', 'descriptor', 'flat, bronze, exc cond, leaves, acorns, urn')
FROM north_hills_ocr_entries source
WHERE source.source_page_index = 7
  AND source.source_page_number = 186
  AND source.source_line_start = 45
  AND source.name_text = 'SCOTT'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. May 16, 1962, 76y 1m 26da. Doc & Ernie''s sister', NULL::date, 'CR: d. May 16, 1962, 76y 1m 26da. Doc & Ernie''s sister', 'review'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 9 AND name_text = 'CREA/ PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 16, 1962', DATE '1962-05-16', 'CR: d. May 16, 1962, 76y 1m 26da. Doc & Ernie''s sister', 'high'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 9 AND name_text = 'CREA/ PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '76y 1m 26d', NULL::date, 'CR: d. May 16, 1962, 76y 1m 26da. Doc & Ernie''s sister', 'medium'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 9 AND name_text = 'CREA/ PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Walter, d. May 4, 1967, 79y 2m 10da', NULL::date, 'CR: Middle name Walter, d. May 4, 1967, 79y 2m 10da', 'review'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 14 AND name_text = 'PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 4, 1967', DATE '1967-05-04', 'CR: Middle name Walter, d. May 4, 1967, 79y 2m 10da', 'high'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 14 AND name_text = 'PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '79y 2m 10d', NULL::date, 'CR: Middle name Walter, d. May 4, 1967, 79y 2m 10da', 'medium'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 14 AND name_text = 'PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Philip Jr., d. July 30, 1949, 84y 4m 22da. Nettie M., d. April 2, 1967, 99y 3m 6da', NULL::date, 'CR: Philip Jr., d. July 30, 1949, 84y 4m 22da. Nettie M., d. April 2, 1967, 99y 3m 6da', 'review'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 21 AND name_text = 'SCHNABEL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'July 30, 1949', DATE '1949-07-30', 'CR: Philip Jr., d. July 30, 1949, 84y 4m 22da. Nettie M., d. April 2, 1967, 99y 3m 6da', 'high'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 21 AND name_text = 'SCHNABEL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'April 2, 1967', DATE '1967-04-02', 'CR: Philip Jr., d. July 30, 1949, 84y 4m 22da. Nettie M., d. April 2, 1967, 99y 3m 6da', 'high'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 21 AND name_text = 'SCHNABEL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '84y 4m 22d', NULL::date, 'CR: Philip Jr., d. July 30, 1949, 84y 4m 22da. Nettie M., d. April 2, 1967, 99y 3m 6da', 'medium'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 21 AND name_text = 'SCHNABEL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '99y 3m 6d', NULL::date, 'CR: Philip Jr., d. July 30, 1949, 84y 4m 22da. Nettie M., d. April 2, 1967, 99y 3m 6da', 'medium'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 21 AND name_text = 'SCHNABEL'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. February 12, 1924, 80y Sm 30da. SK: Co I 78, Regt. PVT', NULL::date, 'CR: d. February 12, 1924, 80y Sm 30da. SK: Co I 78, Regt. PVT', 'review'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 28 AND name_text = 'BRANT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'February 12, 1924', DATE '1924-02-12', 'CR: d. February 12, 1924, 80y Sm 30da. SK: Co I 78, Regt. PVT', 'high'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 28 AND name_text = 'BRANT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Freeman, middle name Paul, Oct. 22, 1915 - May 24, 2001. Beulah, Jan. 17, 1918 - March 3, 1993', NULL::date, 'CR: Freeman, middle name Paul, Oct. 22, 1915 - May 24, 2001. Beulah, Jan. 17, 1918 - March 3, 1993', 'review'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 39 AND name_text = 'SCOTT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Middle name George, May 19, 1938; buried March 10, 1941, 2y 9m+', NULL::date, 'CR: Middle name George, May 19, 1938; buried March 10, 1941, 2y 9m+', 'review'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 45 AND name_text = 'SCOTT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Harold, disappeared July 27, 1978. Date of death is date body was found.', NULL::date, 'CR: Harold, disappeared July 27, 1978. Date of death is date body was found.', 'review'
FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 49 AND name_text = 'SCOTT'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start IN (9, 14, 21, 28, 39, 45, 49)) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 7 AND source_page_number = 186 AND source_line_start = 49 AND name_text = 'SCOTT';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
