--liquibase formatted sql

--changeset cemeterymapping:179-repair-north-hills-page-207 splitStatements:false
UPDATE north_hills_ocr_entries
SET
  source_line_end = 6,
  raw_text = $nhg$MORAN/ DERSTINE (7C, 14, s) flat, bronze, exc cond, oak leaves "Ruby M. Moran / 11-11-11 wife 8-17-80" CR: Middle name Mae, sister of Betty Derstine$nhg$,
  inscription_text = $nhg$Ruby M. Moran / 11-11-11 wife 8-17-80$nhg$,
  updated_at = now()
WHERE source_page_index = 28
  AND source_page_number = 207
  AND parsed_section_name = 'C'
  AND parsed_row_number = 7
  AND parsed_position_number = 14
  AND name_text = 'MORAN/ DERSTINE';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = 'Middle name Mae, sister of Betty Derstine',
  raw_text = 'CR: Middle name Mae, sister of Betty Derstine',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 28
  AND entry.source_page_number = 207
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 7
  AND entry.parsed_position_number = 14
  AND entry.name_text = 'MORAN/ DERSTINE'
  AND fact.source_code = 'CR'
  AND fact.fact_type = 'note';

WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 28
    AND source_page_number = 207
),
stirling AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    batch_id,
    cemetery_id,
    28,
    207,
    7,
    8,
    $nhg$STIRLING (7C, 15, s) pillow, gray granite, exc cond "Anna E. Stirling / 1906-1952 / Daughter"$nhg$,
    'STIRLING',
    ARRAY['STIRLING']::text[],
    'C',
    7,
    15,
    'single',
    'pillow',
    'granite',
    'excellent',
    $nhg$Anna E. Stirling / 1906-1952 / Daughter$nhg$,
    ARRAY[1906, 1952]::integer[],
    'high',
    ARRAY[]::text[],
    jsonb_build_object('heading', 'STIRLING (7C, 15, s) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond')
  FROM page_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = 28
      AND existing.source_page_number = 207
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 7
      AND existing.parsed_position_number = 15
      AND existing.name_text = 'STIRLING'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM stirling;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HARPER (7C, 17, s) pillow, gray granite, exc cond "Elsie K. Harper / 1903-1947 / Daughter"$nhg$,
  inscription_text = $nhg$Elsie K. Harper / 1903-1947 / Daughter$nhg$,
  updated_at = now()
WHERE source_page_index = 28
  AND source_page_number = 207
  AND parsed_section_name = 'C'
  AND parsed_row_number = 7
  AND parsed_position_number = 17
  AND name_text = 'HARPER';

WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id
  FROM north_hills_ocr_entries
  WHERE source_page_index = 28
    AND source_page_number = 207
),
missing_entries AS (
  SELECT *
  FROM (
    VALUES
      (
        18, 22, 'EADIE', ARRAY['EADIE']::text[], 8, 1, 'single', 'flat', 'marble', NULL::text,
        $nhg$EADIE (8C, 1, s) flat, white marble, cross "William L Eadie / Pfc US Army / WW II Bronze Star Medal / Jan 8 1926 Jul 12 2004 / God Bless You & Yours / See you in Heaven - - Bill" CR: Believed to be in plot • with Hilda G. Eadie (9C, 4)$nhg$,
        $nhg$William L Eadie / Pfc US Army / WW II Bronze Star Medal / Jan 8 1926 Jul 12 2004 / God Bless You & Yours / See you in Heaven - - Bill$nhg$,
        ARRAY[1926, 2004]::integer[],
        $json${"heading":"EADIE (8C, 1, s) flat, white marble, cross","descriptor":"flat, white marble, cross"}$json$::jsonb
      ),
      (
        24, 26, 'KNOBLOCH', ARRAY['KNOBLOCH']::text[], 8, 2, 'single', 'pillow', 'granite', 'excellent',
        $nhg$KNOBLOCH (8C, 2, s) plllow, gray granite, exc cond "George R. Knobloch / 1874-1916 / Father" CR: d. June 24, 1916$nhg$,
        $nhg$George R. Knobloch / 1874-1916 / Father$nhg$,
        ARRAY[1874, 1916]::integer[],
        $json${"heading":"KNOBLOCH (8C, 2, s) plllow, gray granite, exc cond","descriptor":"plllow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        28, 29, 'KNOBLOCH', ARRAY['KNOBLOCH']::text[], 8, 3, 'single', 'pillow', 'granite', 'excellent',
        $nhg$KNOBLOCH (8C, 3, s) pillow, gray granite, exc cond "Sara C. Knobloch / 1881-1964 / Mother''$nhg$,
        $nhg$Sara C. Knobloch / 1881-1964 / Mother'$nhg$,
        ARRAY[1881, 1964]::integer[],
        $json${"heading":"KNOBLOCH (8C, 3, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        31, 34, 'KNOBLOCH', ARRAY['KNOBLOCH']::text[], 8, 4, 'monolith', 'upright', 'granite', 'excellent',
        $nhg$KNOBLOCH (8C, 4, monolith) upright, gray granite, exc cond, flowers "Knobloch" On back: "Knobloch" Behind (8C, 5)$nhg$,
        $nhg$Knobloch$nhg$,
        ARRAY[]::integer[],
        $json${"heading":"KNOBLOCH (8C, 4, monolith) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (
        36, 38, 'KNOBLOCH', ARRAY['KNOBLOCH']::text[], 8, 5, 'single', 'pillow', 'granite', 'excellent',
        $nhg$KNOBLOCH (8C, 5, s) pillow, gray granite, exc cond "John W. Knobloch / 1915·1918 / Son" In front of monolith (8C, 4)$nhg$,
        $nhg$John W. Knobloch / 1915·1918 / Son$nhg$,
        ARRAY[1915, 1918]::integer[],
        $json${"heading":"KNOBLOCH (8C, 5, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      )
  ) AS rows(source_line_start, source_line_end, name_text, surnames, parsed_row_number, parsed_position_number, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, source_entry)
),
inserted AS (
  INSERT INTO north_hills_ocr_entries (
    batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
    raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
    parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
    parse_confidence, parse_notes, source_entry
  )
  SELECT
    page_batches.batch_id,
    page_batches.cemetery_id,
    28,
    207,
    missing_entries.source_line_start,
    missing_entries.source_line_end,
    missing_entries.raw_text,
    missing_entries.name_text,
    missing_entries.surnames,
    'C',
    missing_entries.parsed_row_number,
    missing_entries.parsed_position_number,
    missing_entries.parsed_marker_scope,
    missing_entries.marker_type_text,
    missing_entries.material_text,
    missing_entries.condition_text,
    missing_entries.inscription_text,
    missing_entries.parsed_years,
    'high',
    ARRAY[]::text[],
    missing_entries.source_entry
  FROM page_batches
  CROSS JOIN missing_entries
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = 28
      AND existing.source_page_number = 207
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = missing_entries.parsed_row_number
      AND existing.parsed_position_number = missing_entries.parsed_position_number
      AND existing.name_text = missing_entries.name_text
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id, parsed_position_number
),
inserted_facts AS (
  INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  SELECT id, 'CR', 'Church Records', 'note', 'Believed to be in plot • with Hilda G. Eadie (9C, 4)', NULL::date, 'CR: Believed to be in plot • with Hilda G. Eadie (9C, 4)', 'review'
  FROM inserted
  WHERE parsed_position_number = 1
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'note', 'd. June 24, 1916', NULL::date, 'CR: d. June 24, 1916', 'review'
  FROM inserted
  WHERE parsed_position_number = 2
  UNION ALL
  SELECT id, 'CR', 'Church Records', 'death_date', 'June 24, 1916', DATE '1916-06-24', 'CR: d. June 24, 1916', 'high'
  FROM inserted
  WHERE parsed_position_number = 2
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_facts;

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 8,
  raw_text = $nhg$HARPER (8C, 6, s) pillow, gray granite, exc cond "Carl N. Harper / 1931-1933 / Grandson"$nhg$,
  inscription_text = $nhg$Carl N. Harper / 1931-1933 / Grandson$nhg$,
  updated_at = now()
WHERE source_page_index = 28
  AND source_page_number = 207
  AND parsed_section_name = 'C'
  AND parsed_row_number = 5
  AND parsed_position_number = 6
  AND name_text = 'HARPER';

UPDATE north_hills_ocr_entries
SET
  parsed_row_number = 8,
  raw_text = $nhg$HARPER (8C, 7, s) pillow, gray granite, exc cond "Edwin B. Harper/ Sgt. Btry. D 2nd F. A. R. D. / enlisted / July 26, 1918 / discharged / Apr. 16, 1919 / born May 5, 1897 / died June 7, 1939" Separate flag holder: "American / US / Legion", star in circle$nhg$,
  inscription_text = $nhg$Edwin B. Harper/ Sgt. Btry. D 2nd F. A. R. D. / enlisted / July 26, 1918 / discharged / Apr. 16, 1919 / born May 5, 1897 / died June 7, 1939$nhg$,
  updated_at = now()
WHERE source_page_index = 28
  AND source_page_number = 207
  AND parsed_section_name = 'C'
  AND parsed_row_number = 5
  AND parsed_position_number = 7
  AND name_text = 'HARPER';

UPDATE north_hills_ocr_entries
SET
  name_text = 'SOERGEL/HILLMAN',
  surnames = ARRAY['SOERGEL','HILLMAN']::text[],
  raw_text = $nhg$SOERGEL/HILLMAN (8C, 8, c) upright, gray granite, exc cond "Soergel / Peter Soergel / 1862-1936 / Margaret M. His Wife/ 1862- 1919" CR: Peter, d. November 18, 1936. Margaret Hillman Soergel d. Jan. 30, 1919$nhg$,
  source_entry = jsonb_build_object('heading', 'SOERGEL/HILLMAN (8C, 8, c) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 28
  AND source_page_number = 207
  AND parsed_section_name = 'C'
  AND parsed_row_number = 8
  AND parsed_position_number = 8
  AND name_text = 'SOERGEL/HJLLMAN';

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 28 AND source_page_number = 207 AND parsed_row_number = 8 AND parsed_position_number IN (1, 2));
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 28 AND source_page_number = 207 AND parsed_row_number = 7 AND parsed_position_number = 15 AND name_text = 'STIRLING';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 28 AND source_page_number = 207 AND parsed_row_number = 8 AND parsed_position_number IN (1, 2, 3, 4, 5);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
