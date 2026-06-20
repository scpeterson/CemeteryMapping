--liquibase formatted sql

--changeset cemeterymapping:126-repair-north-hills-will-page-199
WITH candidate_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 20
    AND source_page_number = 199
    AND parsed_section_name = 'C'
    AND parsed_row_number = 3
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
    20,
    199,
    27,
    29,
    'WILL (3C, 1, c) upright, pink granite, exc cond, candles, flowers, leaves "Will/ Albert R. / 1886-1959 /Father/ Elva Z. / 1889-1972 / Mother" On back: "Will"',
    'WILL',
    ARRAY['WILL']::text[],
    'C',
    3,
    1,
    'couple',
    'upright',
    'granite',
    'excellent',
    'Will/ Albert R. / 1886-1959 /Father/ Elva Z. / 1889-1972 / Mother',
    ARRAY[1886, 1889, 1959, 1972]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object(
      'heading', 'WILL {JC, 1, c) upright, pink granite, exc cond, candles, flowers,',
      'descriptor', 'upright, pink granite, exc cond, candles, flowers, leaves'
    )
  FROM candidate_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = candidate_batches.batch_id
      AND existing.source_page_number = 199
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 3
      AND existing.parsed_position_number = 1
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_entries;

--rollback DELETE FROM north_hills_ocr_entries WHERE name_text = 'WILL' AND source_page_index = 20 AND source_page_number = 199 AND source_line_start = 27 AND parsed_section_name = 'C' AND parsed_row_number = 3 AND parsed_position_number = 1;
