--liquibase formatted sql

--changeset cemeterymapping:153-repair-north-hills-page-189
UPDATE north_hills_ocr_entries
SET
  raw_text = 'BISH (8A, 6, s) upright, gray granite, exc cond, cross, grapes, strawberries, praying hands "Eric B. Bish / Child of God / 1970 2000" On back: "Bish" CR: d. May 18, 2000. Middle name, Bryan',
  parsed_row_number = 8,
  parsed_section_name = 'A',
  parsed_position_number = 6,
  source_entry = jsonb_build_object('heading', 'BISH (8A, 6, s) upright, gray granite, exc cond, cross, grapes, strawberries, praying hands', 'descriptor', 'upright, gray granite, exc cond, cross, grapes, strawberries, praying hands'),
  updated_at = now()
WHERE source_page_number = 189
  AND source_line_start = 3
  AND name_text = 'BISH';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'COLE/SOERGEL (8A, 8, s) upright, granite, good cond "Susan Soergel / Cole / 1860-1930 / Mother" CR: d. July 29, 1930, 70y Sm 3da',
  parsed_row_number = 8,
  parsed_section_name = 'A',
  parsed_position_number = 8,
  source_entry = jsonb_build_object('heading', 'COLE/SOERGEL (8A, 8, s) upright, granite, good cond', 'descriptor', 'upright, granite, good cond'),
  updated_at = now()
WHERE source_page_number = 189
  AND source_line_start = 12
  AND name_text = 'COLE/SOERGEL';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'SARVER (9A, 1, s) upright, gray granite, exc cond, crosses, wild roses, praying hands "Husband/ Clarence R. Sarver/ Jan. 15 / 1912 / Feb. 4 / 1986"',
  name_text = 'SARVER',
  surnames = ARRAY['SARVER']::text[],
  inscription_text = 'Husband/ Clarence R. Sarver/ Jan. 15 / 1912 / Feb. 4 / 1986',
  source_entry = jsonb_build_object('heading', 'SARVER (9A, 1, s) upright, gray granite, exc cond, crosses, wild roses, praying hands', 'descriptor', 'upright, gray granite, exc cond, crosses, wild roses, praying hands'),
  updated_at = now()
WHERE source_page_number = 189
  AND source_line_start = 17
  AND name_text = 'SARVE.R';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'SARVER (9A, 2, s) pillow, gray granite, exc cond "Son / Lester R. Sarver/ Mar 10 / 1933 / Nov 20"',
  inscription_text = 'Son / Lester R. Sarver/ Mar 10 / 1933 / Nov 20',
  source_entry = jsonb_build_object('heading', 'SARVER (9A, 2, s) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_number = 189
  AND source_line_start = 23
  AND name_text = 'SARVER';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 40,
  raw_text = 'SLANINA (9A, 6, s) upright, gray granite, exc cond, cross, praying hands "Ruth A. Slanina / Oct. 22, 1929 / May 16, 2006 / Beloved Mother" On back: "Slanina" CR: f. May 19, 2006',
  inscription_text = 'Ruth A. Slanina / Oct. 22, 1929 / May 16, 2006 / Beloved Mother Slanina',
  parse_notes = CASE
    WHEN parse_notes @> ARRAY['Cemetery note after this entry: Large empty space to right.']::text[] THEN parse_notes
    ELSE parse_notes || ARRAY['Cemetery note after this entry: Large empty space to right.']::text[]
  END,
  source_entry = jsonb_build_object('heading', 'SLANINA (9A, 6, s) upright, gray granite, exc cond, cross, praying hands', 'descriptor', 'upright, gray granite, exc cond, cross, praying hands'),
  updated_at = now()
WHERE source_page_number = 189
  AND source_line_start = 38
  AND name_text = 'SLANINA';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = 'f. May 19, 2006',
  raw_text = 'CR: f. May 19, 2006',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_number = 189
  AND entry.source_line_start = 38
  AND entry.name_text = 'SLANINA'
  AND fact.source_code = 'CR'
  AND fact.fact_type = 'note';

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
  source.source_page_index,
  189,
  45,
  47,
  'McCONNELL (10A, 1, s) upright, gray granite, exc cond "Mattile IE./ McConnell/ 1891-1932" Separate flag holder: "American/ US/ Legion", star',
  'McCONNELL',
  ARRAY['McCONNELL']::text[],
  'A',
  10,
  1,
  'single',
  'upright',
  'granite',
  'excellent',
  'Mattile IE./ McConnell/ 1891-1932 American/ US/ Legion',
  ARRAY[1891, 1932]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'McCONNELL (10A, 1, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond')
FROM north_hills_ocr_entries source
WHERE source.source_page_number = 189
  AND source.source_line_start = 38
  AND source.name_text = 'SLANINA'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

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
  source.source_page_index,
  189,
  49,
  51,
  'BALZ/ BALTZ (10A, 2, c) upright, white marble, exc cond, wreaths, flowers "Balz/ William J. / 1866-1927 / Charlotte M. / His wife / 1865- 1947" SK: Baltz',
  'BALZ/ BALTZ',
  ARRAY['BALZ', 'BALTZ']::text[],
  'A',
  10,
  2,
  'couple',
  'upright',
  'marble',
  'excellent',
  'Balz/ William J. / 1866-1927 / Charlotte M. / His wife / 1865- 1947',
  ARRAY[1865, 1866, 1927, 1947]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'BALZ/ BALTZ (10A, 2, c) upright, white marble, exc cond, wreaths, flowers', 'descriptor', 'upright, white marble, exc cond, wreaths, flowers')
FROM north_hills_ocr_entries source
WHERE source.source_page_number = 189
  AND source.source_line_start = 38
  AND source.name_text = 'SLANINA'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BALZ/ BALTZ (10A, 2, c) upright, white marble, exc cond, wreaths, flowers "Balz/ William J. / 1866-1927 / Charlotte M. / His wife / 1865- 1947" SK: Baltz',
  inscription_text = 'Balz/ William J. / 1866-1927 / Charlotte M. / His wife / 1865- 1947',
  parsed_row_number = 10,
  parsed_section_name = 'A',
  parsed_position_number = 2,
  source_entry = jsonb_build_object('heading', 'BALZ/ BALTZ (10A, 2, c) upright, white marble, exc cond, wreaths, flowers', 'descriptor', 'upright, white marble, exc cond, wreaths, flowers'),
  updated_at = now()
WHERE source_page_number = 189
  AND source_line_start = 49
  AND name_text = 'BALZ/ BALTZ';

--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 189 AND source_line_start = 45 AND name_text = 'McCONNELL';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 189 AND source_line_start = 49 AND name_text = 'BALZ/ BALTZ' AND batch_id IN (SELECT batch_id FROM north_hills_ocr_entries WHERE source_page_number = 189 AND source_line_start = 45 AND name_text = 'McCONNELL');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'north_hills_ocr_entries';
