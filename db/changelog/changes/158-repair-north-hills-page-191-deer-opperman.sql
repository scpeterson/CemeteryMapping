--liquibase formatted sql

--changeset cemeterymapping:158-repair-north-hills-page-191-deer-opperman
UPDATE north_hills_ocr_entries
SET
  raw_text = 'OPPERMAN (1B, 6, c) upright, gray granite, exc cond, flowers "Opperman/ Caroline M. / 1887-1966 / Ida 0. / 1884-1924" On back: "Opperman / Carl / 1892-1893 / Anna A. / 1889-1899 / Mary S. / 1858-1909 / William / 1880-1953"',
  inscription_text = 'Opperman/ Caroline M. / 1887-1966 / Ida 0. / 1884-1924 Opperman / Carl / 1892-1893 / Anna A. / 1889-1899 / Mary S. / 1858-1909 / William / 1880-1953',
  parsed_years = ARRAY[1880, 1884, 1887, 1889, 1892, 1893, 1899, 1909, 1924, 1953, 1966]::integer[],
  source_entry = jsonb_build_object('heading', 'OPPERMAN (1B, 6, c) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_index = 12
  AND source_page_number = 191
  AND source_line_start = 5
  AND name_text = 'OPPERMAN';

WITH page_191_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 12
    AND source_page_number = 191
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
  191,
  19,
  23,
  'MILLER/MULLER (2B, 3, c) obelisk, gray marble, good cond "John / Miller / 1803-1875 / Mary Miller / 1810-1902" CRG: Johannes Müller, b. 24 June 1803, d. 20 April 1876, age 73y, f. 22 April. He was from Dudenhofen, Kreis Wetzlar, Prussia',
  'MILLER/MULLER',
  ARRAY['MILLER', 'MULLER']::text[],
  'B',
  2,
  3,
  'couple',
  'obelisk',
  'marble',
  'good',
  'John / Miller / 1803-1875 / Mary Miller / 1810-1902',
  ARRAY[1803, 1810, 1875, 1876, 1902]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'MILLER/MULLER (2B, 3, c) obelisk, gray marble, good cond', 'descriptor', 'obelisk, gray marble, good cond')
FROM page_191_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (
  entry_id,
  source_code,
  source_label,
  fact_type,
  fact_value,
  fact_date,
  raw_text,
  confidence
)
SELECT
  id,
  'CRG',
  'Church Records in German',
  'death_date',
  '20 April 1876',
  DATE '1876-04-20',
  'CRG: Johannes Müller, b. 24 June 1803, d. 20 April 1876, age 73y, f. 22 April. He was from Dudenhofen, Kreis Wetzlar, Prussia',
  'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 12
  AND source_page_number = 191
  AND source_line_start = 19
  AND name_text = 'MILLER/MULLER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (
  entry_id,
  source_code,
  source_label,
  fact_type,
  fact_value,
  raw_text,
  confidence
)
SELECT
  id,
  'CRG',
  'Church Records in German',
  'note',
  'Johannes Müller, b. 24 June 1803, d. 20 April 1876, age 73y, f. 22 April. He was from Dudenhofen, Kreis Wetzlar, Prussia',
  'CRG: Johannes Müller, b. 24 June 1803, d. 20 April 1876, age 73y, f. 22 April. He was from Dudenhofen, Kreis Wetzlar, Prussia',
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 12
  AND source_page_number = 191
  AND source_line_start = 19
  AND name_text = 'MILLER/MULLER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH page_191_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 12
    AND source_page_number = 191
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
  191,
  25,
  26,
  '[DEER] (2B, 4, s) upright, small white marble, poor cond "Mother" See Deer family obelisk, (2B, 5)',
  '[DEER]',
  ARRAY['DEER']::text[],
  'B',
  2,
  4,
  'single',
  'upright',
  'marble',
  'poor',
  'Mother',
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', '[DEER] (2B, 4, s) upright, small white marble, poor cond', 'descriptor', 'upright, small white marble, poor cond')
FROM page_191_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 34,
  raw_text = 'DEER (2B, 5, c) obelisk, white marble, poor cond. On front: "F. Myrtle / Deer / 1871-1898 / Nannie N /Deer/ 1868-1905" On left: "Mary, / wife of / Wm Deer, / born / Oct. 20, 1838 / died / June 8, 1893 / Weep not she is not / dead, but sleepeth" On back: "William / Deer, / born / Sep. 3, 1828 / died / Sep. 22, 1911" CR: William, d. Sept. 24, 1911. SK: F. Myrtle, d. 1895 Note: See marker for Nannie at (1B, 4) and for Myrtle at (1B, 5)',
  inscription_text = 'F. Myrtle / Deer / 1871-1898 / Nannie N /Deer/ 1868-1905 Mary, / wife of / Wm Deer, / born / Oct. 20, 1838 / died / June 8, 1893 / Weep not she is not / dead, but sleepeth William / Deer, / born / Sep. 3, 1828 / died / Sep. 22, 1911',
  parsed_years = ARRAY[1828, 1838, 1871, 1893, 1895, 1898, 1905, 1911]::integer[],
  source_entry = jsonb_build_object('heading', 'DEER (2B, 5, c) obelisk, white marble, poor cond', 'descriptor', 'obelisk, white marble, poor cond. On front:'),
  updated_at = now()
WHERE source_page_index = 12
  AND source_page_number = 191
  AND source_line_start = 29
  AND name_text = 'DEER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = CASE
    WHEN fact.fact_type = 'note' THEN 'William, d. Sept. 24, 1911. SK: F. Myrtle, d. 1895 Note: See marker for Nannie at (1B, 4) and for Myrtle at (1B, 5)'
    ELSE fact.fact_value
  END,
  raw_text = 'CR: William, d. Sept. 24, 1911. SK: F. Myrtle, d. 1895 Note: See marker for Nannie at (1B, 4) and for Myrtle at (1B, 5)',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 12
  AND entry.source_page_number = 191
  AND entry.source_line_start = 29
  AND entry.name_text = 'DEER'
  AND fact.source_code = 'CR';

WITH page_191_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 12
    AND source_page_number = 191
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
  191,
  36,
  37,
  '[DEER] (2B, 6, s) upright, small white marble, poor cond "Father" See Deer family obelisk, (2B, 5)',
  '[DEER]',
  ARRAY['DEER']::text[],
  'B',
  2,
  6,
  'single',
  'upright',
  'marble',
  'poor',
  'Father',
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', '[DEER] (2B, 6, s) upright, small white marble, poor cond', 'descriptor', 'upright, small white marble, poor cond')
FROM page_191_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 12 AND source_page_number = 191 AND source_line_start = 19 AND name_text = 'MILLER/MULLER');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 12 AND source_page_number = 191 AND source_line_start IN (19, 25, 36) AND name_text IN ('MILLER/MULLER', '[DEER]');
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
