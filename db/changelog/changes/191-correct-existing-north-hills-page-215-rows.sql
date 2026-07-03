--liquibase formatted sql

--changeset cemeterymapping:191-correct-existing-north-hills-page-215-rows splitStatements:false
WITH updated_entries AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = corrections.source_line_end,
    raw_text = corrections.raw_text,
    name_text = corrections.name_text,
    surnames = corrections.surnames,
    parsed_section_name = 'C',
    parsed_row_number = corrections.parsed_row_number,
    parsed_position_number = corrections.parsed_position_number,
    parsed_marker_scope = corrections.parsed_marker_scope,
    marker_type_text = corrections.marker_type_text,
    material_text = corrections.material_text,
    condition_text = corrections.condition_text,
    inscription_text = corrections.inscription_text,
    parsed_years = corrections.parsed_years,
    parse_confidence = 'high',
    parse_notes = corrections.parse_notes,
    source_entry = corrections.source_entry,
    updated_at = now()
  FROM (
    VALUES
      (
        14, 8, 5, 'CRERAR', ARRAY['CRERAR']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$CRERAR (14C, 8, s) upright, gray granite, exc cond, flowers "James Crerar / May 6, 1905 / Jan. 19, 1954 / Father" CR: d. January 19, 1954, 48y 8m 13da$nhg$,
        $nhg$James Crerar / May 6, 1905 / Jan. 19, 1954 / Father$nhg$,
        ARRAY[1905, 1954]::integer[],
        ARRAY[]::text[],
        $json${"heading":"CRERAR (14C, 8, s) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (
        15, 2, 23, 'ROBERTSON', ARRAY['ROBERTSON']::text[], 'single', 'flat', 'bronze', 'excellent',
        $nhg$ROBERTSON (15C, 2, s) flat, bronze, exc cond, cross "Helen W Robertson / Beloved wife / Sep 9 1899 Nov 10 1992"$nhg$,
        $nhg$Helen W Robertson / Beloved wife / Sep 9 1899 Nov 10 1992$nhg$,
        ARRAY[1899, 1992]::integer[],
        ARRAY[]::text[],
        $json${"heading":"ROBERTSON (15C, 2, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (
        15, 5, 34, 'HOERR', ARRAY['HOERR']::text[], 'single', 'flat', 'bronze', 'excellent',
        $nhg$HOERR (15C, 5, s) flat, bronze, exc cond, cross "William H. Hoerr / June 18 1902 - Oct 8 1984" Separate flag holder: "US / Veteran", star$nhg$,
        $nhg$William H. Hoerr / June 18 1902 - Oct 8 1984 US / Veteran$nhg$,
        ARRAY[1902, 1984]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HOERR (15C, 5, s) flat, bronze, exc cond, cross","descriptor":"flat, bronze, exc cond, cross"}$json$::jsonb
      ),
      (
        15, 6, 37, 'DODSON', ARRAY['DODSON']::text[], 'single', 'flat', 'granite', 'excellent',
        $nhg$DODSON (15C, 6, s) flat, red granite, exc cond "In loving memory / Paul G. Dodson / 1914-1992"$nhg$,
        $nhg$In loving memory / Paul G. Dodson / 1914-1992$nhg$,
        ARRAY[1914, 1992]::integer[],
        ARRAY[]::text[],
        $json${"heading":"DODSON (15C, 6, s) flat, red granite, exc cond","descriptor":"flat, red granite, exc cond"}$json$::jsonb
      ),
      (
        15, 8, 46, 'GILES', ARRAY['GILES']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$GILES (15C, 8, s) pillow, red granite, exc cond 'Tornelia Giles/ 1900- 1953"$nhg$,
        $nhg$Tornelia Giles/ 1900- 1953$nhg$,
        ARRAY[1900, 1953]::integer[],
        ARRAY['Plot marker, gray granite "W".']::text[],
        $json${"heading":"GILES (15C, 8, s) pillow, red granite, exc cond","descriptor":"pillow, red granite, exc cond"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 215
    AND entry.parsed_section_name = 'C'
    AND entry.parsed_row_number = corrections.parsed_row_number
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING updated_entries
  WHERE fact.entry_id = updated_entries.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (14, 8, 'CR', 'Church Records', 'death_date', 'January 19, 1954', DATE '1954-01-19', 'CR: d. January 19, 1954, 48y 8m 13da', 'high'),
    (14, 8, 'CR', 'Church Records', 'note', 'd. January 19, 1954, 48y 8m 13da', NULL::date, 'CR: d. January 19, 1954, 48y 8m 13da', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 215
  AND entry.parsed_section_name = 'C'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 215 AND parsed_section_name = 'C' AND ((parsed_row_number = 14 AND parsed_position_number = 8) OR (parsed_row_number = 15 AND parsed_position_number IN (2, 5, 6, 8)))) AND source_code = 'CR';
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
