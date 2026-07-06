--liquibase formatted sql

--changeset cemeterymapping:215-repair-north-hills-page-233 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index + 1 AS source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 232
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        2, 4, 'KNOBLOCH', ARRAY['KNOBLOCH']::text[], 'E', 8, 2, 'single', 'upright', 'granite', 'excellent',
        $nhg$KNOBLOCH (8E, 2, s) upright, granite, exc cond, ivy "John M. Knobloch / 1871-1900 / Asleep in Jesus"$nhg$,
        $nhg$John M. Knobloch / 1871-1900 / Asleep in Jesus$nhg$,
        ARRAY[1871, 1900]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KNOBLOCH (8E, 2, s) upright, granite, exc cond, ivy","descriptor":"upright, granite, exc cond, ivy"}$json$::jsonb
      ),
      (
        6, 10, '[KNOBLOCH]', ARRAY['KNOBLOCH']::text[], 'E', 8, 3, 'single', 'upright', 'marble', 'poor',
        $nhg$[KNOBLOCH] (8E, 3, s) upright, white marble, poor cond, fallen, clasped hands, inscription in shield "[-] [Knobloch] / geboren / den 18 Sept. 1811 / gestorben / den 20 Aug. 1863" Note: Same shape & design as (8E, 4, s) Note: her husband, Casper Knobloch$nhg$,
        $nhg$[-] [Knobloch] / geboren / den 18 Sept. 1811 / gestorben / den 20 Aug. 1863$nhg$,
        ARRAY[1811, 1863]::integer[],
        ARRAY['Same shape & design as (8E, 4, s).', 'Her husband, Casper Knobloch.']::text[],
        $json${"heading":"[KNOBLOCH] (8E, 3, s) upright, white marble, poor cond, fallen, clasped hands, inscription in shield","descriptor":"upright, white marble, poor cond, fallen, clasped hands, inscription in shield"}$json$::jsonb
      ),
      (
        12, 17, 'KNOBLOCH', ARRAY['KNOBLOCH']::text[], 'E', 8, 4, 'single', 'upright', 'marble', 'poor',
        $nhg$KNOBLOCH (8E, 4, s) upright, white marble, poor cond, fallen, writing hand, inscription in shield "Hier ruht / Anna Charlotte / Knobloch / geboren / den 13 Marz; 1800 / gestorben / den 1 Marz 1862 / [illegible lines]" Note: Same shape & design as (8E, 3, s)$nhg$,
        $nhg$Hier ruht / Anna Charlotte / Knobloch / geboren / den 13 Marz; 1800 / gestorben / den 1 Marz 1862 / [illegible lines]$nhg$,
        ARRAY[1800, 1862]::integer[],
        ARRAY['Same shape & design as (8E, 3, s).']::text[],
        $json${"heading":"KNOBLOCH (8E, 4, s) upright, white marble, poor cond, fallen, writing hand, inscription in shield","descriptor":"upright, white marble, poor cond, fallen, writing hand, inscription in shield"}$json$::jsonb
      )
  ) AS values(source_line_start, source_line_end, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
),
inserted_missing AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    page_batches.batch_id,
    page_batches.cemetery_id,
    page_batches.source_page_index,
    233,
    entry_values.source_line_start,
    entry_values.source_line_end,
    entry_values.raw_text,
    entry_values.name_text,
    entry_values.surnames,
    entry_values.parsed_section_name,
    entry_values.parsed_row_number,
    entry_values.parsed_position_number,
    entry_values.parsed_marker_scope,
    entry_values.marker_type_text,
    entry_values.material_text,
    entry_values.condition_text,
    entry_values.inscription_text,
    entry_values.parsed_years,
    'high',
    entry_values.parse_notes,
    entry_values.source_entry
  FROM page_batches
  CROSS JOIN entry_values
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = page_batches.source_page_index
      AND existing.source_page_number = 233
      AND existing.parsed_section_name = entry_values.parsed_section_name
      AND existing.parsed_row_number = entry_values.parsed_row_number
      AND existing.parsed_position_number = entry_values.parsed_position_number
      AND existing.name_text = entry_values.name_text
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_missing;

--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 233 AND parsed_section_name = 'E' AND parsed_row_number = 8 AND parsed_position_number IN (2, 3, 4);
