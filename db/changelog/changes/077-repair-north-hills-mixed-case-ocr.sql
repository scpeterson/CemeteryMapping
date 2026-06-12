--liquibase formatted sql

--changeset cemeterymapping:077-repair-north-hills-mixed-case-ocr
UPDATE north_hills_ocr_entries
SET
  name_text = regexp_replace(name_text, '^([A-Z])\[-[0-9Il]$', '\1[-]'),
  surnames = ARRAY[]::text[]
WHERE name_text ~ '^[A-Z]\[-[0-9Il]$';

UPDATE north_hills_ocr_entries
SET source_page_number = 198
WHERE source_page_index = 19
  AND source_page_number IS NULL
  AND parsed_section_name = 'C'
  AND parsed_row_number = 2;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 28,
  raw_text = 'WISKEMAN (2C, 7, s) flat, gray granite military marker, exc cond, cross "John G. Wiskeman / US Army/ World War II/ Jan 6 1926 Aug 26 2005 / Lovingly known as Jack"',
  parsed_years = ARRAY[1926, 2005]::integer[],
  source_entry = jsonb_build_object(
    'heading', 'WISKEMAN (2C, 7, s) flat, gray granite military marker, exc cond,',
    'descriptor', 'flat, gray granite military marker, exc cond, cross'
  )
WHERE raw_text LIKE 'WISKEMAN (2C, 7, s)%HtEBER (2C, 8, c)%';

WITH candidate_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 18
    AND source_page_number = 197
    AND parsed_section_name = 'C'
    AND parsed_row_number = 1
),
inserted_entries AS (
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
    batch_id,
    cemetery_id,
    18,
    197,
    51,
    53,
    'McWILLIAMS (2C, 1, s) pillow, gray granite, good cond, flower "Brother/ Henry McWilllams / 1909-1965" CR: Middle Initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"',
    'McWILLIAMS',
    ARRAY['McWILLIAMS']::text[],
    'C',
    2,
    1,
    'single',
    'pillow',
    'granite',
    'good',
    'Brother/ Henry McWilllams / 1909-1965',
    ARRAY[1909, 1965]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object(
      'heading', 'McWILLIAMS (2C, 1, s) pillow, gray granite, good cond, flower',
      'descriptor', 'pillow, gray granite, good cond, flower'
    )
  FROM candidate_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = candidate_batches.batch_id
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 2
      AND existing.parsed_position_number = 1
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'Middle Initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"', NULL::date, 'CR: Middle Initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"', 'review'
FROM inserted_entries
UNION ALL
SELECT id, 'CR', 'Church Records', 'middle_initial', 'T.', NULL::date, 'CR: Middle Initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"', 'medium'
FROM inserted_entries
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'December 16, 1965', DATE '1965-12-16', 'CR: Middle Initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"', 'high'
FROM inserted_entries
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '56y 5m 25d', NULL::date, 'CR: Middle Initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"', 'medium'
FROM inserted_entries
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH candidate_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 19
    AND parsed_section_name = 'C'
    AND parsed_row_number = 2
),
inserted_entries AS (
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
    batch_id,
    cemetery_id,
    19,
    198,
    30,
    32,
    'HtEBER (2C, 8, c) upright, gray granite, exc cond, flowers, leaves with basket weave "Hieber/ David L. / 1867-1940 /Father/ Anna C. / 1873-1949 / Mother" On back: "Hieber"',
    'HtEBER',
    ARRAY['HtEBER']::text[],
    'C',
    2,
    8,
    'couple',
    'upright',
    'granite',
    'excellent',
    'Hieber/ David L. / 1867-1940 /Father/ Anna C. / 1873-1949 / Mother',
    ARRAY[1867, 1873, 1940, 1949]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object(
      'heading', 'HtEBER (2C, 8, c) upright, gray granite, exc cond, flowers, leaves',
      'descriptor', 'upright, gray granite, exc cond, flowers, leaves with basket weave'
    )
  FROM candidate_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = candidate_batches.batch_id
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 2
      AND existing.parsed_position_number = 8
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_entries;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE name_text = 'McWILLIAMS' AND source_page_index = 18 AND source_line_start = 51);
--rollback DELETE FROM north_hills_ocr_entries WHERE name_text = 'McWILLIAMS' AND source_page_index = 18 AND source_line_start = 51;
--rollback DELETE FROM north_hills_ocr_entries WHERE name_text = 'HtEBER' AND source_page_index = 19 AND source_line_start = 30;
