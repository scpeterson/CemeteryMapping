--liquibase formatted sql

--changeset cemeterymapping:146-repair-north-hills-burgess-stertz-page-183
UPDATE north_hills_ocr_entries
SET
  raw_text = 'BURGESS (1A, 1, s) pillow, gray granite, exc cond "George L. / 1876- 1942 / Father" See Burgess monolith (2A, 6)',
  inscription_text = 'George L. / 1876- 1942 / Father',
  source_entry = jsonb_build_object(
    'heading', 'BURGESS (1A, 1, s) pillow, gray granite, exc cond',
    'descriptor', 'pillow, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 183
  AND source_line_start = 22
  AND name_text = 'BURGESS';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BURGESS/OPPERMAN (1A, 2, s) pillow, gray granite, exc cond "Mary Opperman/ 1882-1946 / Mother" See Burgess monolith (2A, 6)',
  source_entry = jsonb_build_object(
    'heading', 'BURGESS/OPPERMAN (1A, 2, s) pillow, gray granite, exc cond',
    'descriptor', 'pillow, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 183
  AND source_line_start = 25
  AND name_text = 'BURGESS/OPPERMAN';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BURGESS (1A, 3, s) pillow, gray granite, exc cond "George L., Jr./ 1909 - 1913 / Son" See Burgess monolith (2A, 6)',
  source_entry = jsonb_build_object(
    'heading', 'BURGESS (1A, 3, s) pillow, gray granite, exc cond',
    'descriptor', 'pillow, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 183
  AND source_line_start = 28
  AND name_text = 'BURGESS';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 48,
  raw_text = 'STERTZ (2A, 4, c) upright, gray granite, exc cond, leaves, scroll, flower "Stertz / Alexander F. / Mar. 28, 1896 / Jan. 9, 1954 /Father/ Emma S. / Nov. 25, 1891 [blank]/ Mother" CR: Emma, d. Jan. 23, 1985',
  inscription_text = 'Stertz / Alexander F. / Mar. 28, 1896 / Jan. 9, 1954 /Father/ Emma S. / Nov. 25, 1891 [blank]/ Mother',
  parsed_years = ARRAY[1891, 1896, 1954, 1985]::integer[],
  source_entry = jsonb_build_object(
    'heading', 'STERTZ (2A, 4, c) upright, gray granite, exc cond, leaves, scroll, flower',
    'descriptor', 'upright, gray granite, exc cond, leaves, scroll, flower'
  ),
  updated_at = now()
WHERE source_page_number = 183
  AND source_line_start = 45
  AND name_text = 'STERTZ'
  AND raw_text ILIKE '%STERTZ (2A, 5 s)%';

DELETE FROM north_hills_ocr_source_facts
WHERE entry_id IN (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 183
    AND source_line_start = 45
    AND name_text = 'STERTZ'
)
AND source_code = 'CR';

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Emma, d. Jan. 23, 1985', NULL::date, 'CR: Emma, d. Jan. 23, 1985', 'review'
FROM north_hills_ocr_entries
WHERE source_page_number = 183
  AND source_line_start = 45
  AND name_text = 'STERTZ'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'January 23, 1985', DATE '1985-01-23', 'CR: Emma, d. Jan. 23, 1985', 'high'
FROM north_hills_ocr_entries
WHERE source_page_number = 183
  AND source_line_start = 45
  AND name_text = 'STERTZ'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

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
  183,
  50,
  52,
  'STERTZ (2A, 5, s) flat, bronze, exc cond "James F Stertz / AMN US Air Force/ Korea/ Sep 5 1928 / Nov 1 1984" Separate flag holder: "World War II / Veteran"',
  'STERTZ',
  ARRAY['STERTZ']::text[],
  'A',
  2,
  5,
  'single',
  'flat',
  'bronze',
  'excellent',
  'James F Stertz / AMN US Air Force/ Korea/ Sep 5 1928 / Nov 1 1984 World War II / Veteran',
  ARRAY[1928, 1984]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object(
    'heading', 'STERTZ (2A, 5, s) flat, bronze, exc cond',
    'descriptor', 'flat, bronze, exc cond'
  )
FROM north_hills_ocr_entries source
WHERE source.source_page_number = 183
  AND source.source_line_start = 45
  AND source.name_text = 'STERTZ'
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = 'STERTZ (2A, 5, s) flat, bronze, exc cond "James F Stertz / AMN US Air Force/ Korea/ Sep 5 1928 / Nov 1 1984" Separate flag holder: "World War II / Veteran"',
  source_entry = jsonb_build_object(
    'heading', 'STERTZ (2A, 5, s) flat, bronze, exc cond',
    'descriptor', 'flat, bronze, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 183
  AND source_line_start = 50
  AND name_text = 'STERTZ';

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 183 AND source_line_start = 45 AND name_text = 'STERTZ') AND source_code = 'CR';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
