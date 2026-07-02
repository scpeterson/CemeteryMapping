--liquibase formatted sql

--changeset cemeterymapping:184-repair-north-hills-page-211 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 211
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 6, 'KNOBELOCH', ARRAY['KNOBELOCH']::text[], 11, 8, 'couple', 'upright', 'granite', 'excellent',
        $nhg$KNOBELOCH (11C, 8, c) upright, gray granite, exc cond, grapes, leaves "William G. / 1877-1957 / Father / Emma M. / 1882-1968 / Mother" On back: "Knobeloch" CR: William, d. December 21, 1957, 80y 1m 13da. Emma, d. October 6, 1968$nhg$,
        $nhg$William G. / 1877-1957 / Father / Emma M. / 1882-1968 / Mother Knobeloch$nhg$,
        ARRAY[1877, 1882, 1957, 1968]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KNOBELOCH (11C, 8, c) upright, gray granite, exc cond, grapes, leaves","descriptor":"upright, gray granite, exc cond, grapes, leaves"}$json$::jsonb
      ),
      (
        8, 10, 'KNOBELOCH/KNOBLOCK', ARRAY['KNOBELOCH','KNOBLOCK']::text[], 11, 9, 'single', 'upright', 'granite', 'excellent',
        $nhg$KNOBELOCH/KNOBLOCK (11C, 9, s) upright, gray granite, exc cond "Evelyn M. / Knobeloch / 1916-1917 / Daughter" CR: Evelyn Marie Knoblock, d. February 16, 1917, 3m, dau of Wm K.$nhg$,
        $nhg$Evelyn M. / Knobeloch / 1916-1917 / Daughter$nhg$,
        ARRAY[1916, 1917]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KNOBELOCH/KNOBLOCK (11C, 9, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      )
  ) AS values(source_line_start, source_line_end, name_text, surnames, parsed_row_number, parsed_position_number, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
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
    211,
    entry_values.source_line_start,
    entry_values.source_line_end,
    entry_values.raw_text,
    entry_values.name_text,
    entry_values.surnames,
    'C',
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
      AND existing.source_page_number = 211
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = entry_values.parsed_row_number
      AND existing.parsed_position_number = entry_values.parsed_position_number
      AND existing.name_text = entry_values.name_text
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_missing;

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
        11, 10, 14, 'BRANDT/BRANT', ARRAY['BRANDT','BRANT']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$BRANDT/BRANT (11C, 10, s) pillow, gray granite, exc cond, grapes, leaves "Robert D. Brandt/ 1936-1969" CR: Brant, d. February 23, 1969, 32y$nhg$,
        $nhg$Robert D. Brandt/ 1936-1969$nhg$,
        ARRAY[1936, 1969]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT/BRANT (11C, 10, s) pillow, gray granite, exc cond, grapes, leaves","descriptor":"pillow, gray granite, exc cond, grapes, leaves"}$json$::jsonb
      ),
      (
        11, 12, 25, 'BRANT/HARTMAN', ARRAY['BRANT','HARTMAN']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BRANT/HARTMAN (11C, 12, s) upright, gray granite, exc cond, grapes, leaves "Charles Hartman Brant / June 19, 1911 - Sept. 23, 1981 / Beloved Son / 'I worked the land/ And now we are one'"$nhg$,
        $nhg$Charles Hartman Brant / June 19, 1911 - Sept. 23, 1981 / Beloved Son / 'I worked the land/ And now we are one'$nhg$,
        ARRAY[1911, 1981]::integer[],
        ARRAY['Plot marker, white marble, "B".']::text[],
        $json${"heading":"BRANT/HARTMAN (11C, 12, s) upright, gray granite, exc cond, grapes, leaves","descriptor":"upright, gray granite, exc cond, grapes, leaves"}$json$::jsonb
      ),
      (
        11, 14, 35, 'BRANDT', ARRAY['BRANDT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BRANDT (11C, 14, s) upright, gray granite, exc cond "George S. Brandt / 1872-1926" CR: d. October 14, 1926$nhg$,
        $nhg$George S. Brandt / 1872-1926$nhg$,
        ARRAY[1872, 1926]::integer[],
        ARRAY['Plot marker, white marble, "B".','6 inch by 6 inch white marble square marker, no inscription.']::text[],
        $json${"heading":"BRANDT (11C, 14, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 211
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

WITH source_entries AS (
  SELECT id, batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 211
    AND parsed_section_name = 'C'
    AND parsed_row_number = 11
    AND parsed_position_number = 10
    AND name_text = 'BRANDT/BRANT'
),
inserted AS (
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
    211,
    16,
    20,
    $nhg$BRANT (11C, 11, c) upright, gray granite, exc cond, church windows "Brant / George W. / 1868-1931 / Father / Anna C. / 1885-1968 / Mother" CR: George, d. February 10, 1931, 62y 11m 19da. Anna, d. May 3, 1968, 82y 9m 27da$nhg$,
    'BRANT',
    ARRAY['BRANT']::text[],
    'C',
    11,
    11,
    'couple',
    'upright',
    'granite',
    'excellent',
    $nhg$Brant / George W. / 1868-1931 / Father / Anna C. / 1885-1968 / Mother$nhg$,
    ARRAY[1868, 1885, 1931, 1968]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"BRANT (11C, 11, c) upright, gray granite, exc cond, church windows","descriptor":"upright, gray granite, exc cond, church windows"}$json$::jsonb
  FROM source_entries
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = source_entries.batch_id
      AND existing.source_page_index = source_entries.source_page_index
      AND existing.source_page_number = 211
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 11
      AND existing.parsed_position_number = 11
      AND existing.name_text = 'BRANT'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted;

WITH source_entries AS (
  SELECT id, batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 211
    AND parsed_section_name = 'C'
    AND parsed_row_number = 11
    AND parsed_position_number = 12
    AND name_text = 'BRANT/HARTMAN'
),
inserted AS (
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
    211,
    27,
    31,
    $nhg$BRANDT (11C, 13, s) upright, gray granite, exc cond, vine of flowers, leaves "Brother/ Henry G. Brandt / 1862-1921 / At rest" CR: d. July 2, 1921, 59y$nhg$,
    'BRANDT',
    ARRAY['BRANDT']::text[],
    'C',
    11,
    13,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Brother/ Henry G. Brandt / 1862-1921 / At rest$nhg$,
    ARRAY[1862, 1921]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"BRANDT (11C, 13, s) upright, gray granite, exc cond, vine of flowers, leaves","descriptor":"upright, gray granite, exc cond, vine of flowers, leaves"}$json$::jsonb
  FROM source_entries
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = source_entries.batch_id
      AND existing.source_page_index = source_entries.source_page_index
      AND existing.source_page_number = 211
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 11
      AND existing.parsed_position_number = 13
      AND existing.name_text = 'BRANDT'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted;

WITH source_entries AS (
  SELECT id, batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 211
    AND parsed_section_name = 'C'
    AND parsed_row_number = 11
    AND parsed_position_number = 14
    AND name_text = 'BRANDT'
),
inserted AS (
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
    211,
    38,
    41,
    $nhg$HABBERT/ALT (11C, 15, s) upright, gray granite, exc cond, wild rose "Mother / Mabel M. Alt / Habbert / July 17, 1905 / May 1, 2000"$nhg$,
    'HABBERT/ALT',
    ARRAY['HABBERT','ALT']::text[],
    'C',
    11,
    15,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$Mother / Mabel M. Alt / Habbert / July 17, 1905 / May 1, 2000$nhg$,
    ARRAY[1905, 2000]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"HABBERT/ALT (11C, 15, s) upright, gray granite, exc cond, wild rose","descriptor":"upright, gray granite, exc cond, wild rose"}$json$::jsonb
  FROM source_entries
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = source_entries.batch_id
      AND existing.source_page_index = source_entries.source_page_index
      AND existing.source_page_number = 211
      AND existing.parsed_section_name = 'C'
      AND existing.parsed_row_number = 11
      AND existing.parsed_position_number = 15
      AND existing.name_text = 'HABBERT/ALT'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted;

WITH affected_entries AS (
  SELECT id, parsed_position_number, name_text
  FROM north_hills_ocr_entries
  WHERE source_page_number = 211
    AND parsed_section_name = 'C'
    AND parsed_row_number = 11
    AND parsed_position_number IN (8, 9, 10, 11, 13, 14)
)
INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'William, d. December 21, 1957, 80y 1m 13da. Emma, d. October 6, 1968', NULL::date, 'CR: William, d. December 21, 1957, 80y 1m 13da. Emma, d. October 6, 1968', 'review'
FROM affected_entries WHERE parsed_position_number = 8
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'December 21, 1957', DATE '1957-12-21', 'CR: William, d. December 21, 1957, 80y 1m 13da. Emma, d. October 6, 1968', 'high'
FROM affected_entries WHERE parsed_position_number = 8
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'October 6, 1968', DATE '1968-10-06', 'CR: William, d. December 21, 1957, 80y 1m 13da. Emma, d. October 6, 1968', 'high'
FROM affected_entries WHERE parsed_position_number = 8
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Evelyn Marie Knoblock, d. February 16, 1917, 3m, dau of Wm K.', NULL::date, 'CR: Evelyn Marie Knoblock, d. February 16, 1917, 3m, dau of Wm K.', 'review'
FROM affected_entries WHERE parsed_position_number = 9
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'February 16, 1917', DATE '1917-02-16', 'CR: Evelyn Marie Knoblock, d. February 16, 1917, 3m, dau of Wm K.', 'high'
FROM affected_entries WHERE parsed_position_number = 9
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '3m', NULL::date, 'CR: Evelyn Marie Knoblock, d. February 16, 1917, 3m, dau of Wm K.', 'medium'
FROM affected_entries WHERE parsed_position_number = 9
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Brant, d. February 23, 1969, 32y', NULL::date, 'CR: Brant, d. February 23, 1969, 32y', 'review'
FROM affected_entries WHERE parsed_position_number = 10
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'February 23, 1969', DATE '1969-02-23', 'CR: Brant, d. February 23, 1969, 32y', 'high'
FROM affected_entries WHERE parsed_position_number = 10
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '32y', NULL::date, 'CR: Brant, d. February 23, 1969, 32y', 'medium'
FROM affected_entries WHERE parsed_position_number = 10
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'George, d. February 10, 1931, 62y 11m 19da. Anna, d. May 3, 1968, 82y 9m 27da', NULL::date, 'CR: George, d. February 10, 1931, 62y 11m 19da. Anna, d. May 3, 1968, 82y 9m 27da', 'review'
FROM affected_entries WHERE parsed_position_number = 11
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'February 10, 1931', DATE '1931-02-10', 'CR: George, d. February 10, 1931, 62y 11m 19da. Anna, d. May 3, 1968, 82y 9m 27da', 'high'
FROM affected_entries WHERE parsed_position_number = 11
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 3, 1968', DATE '1968-05-03', 'CR: George, d. February 10, 1931, 62y 11m 19da. Anna, d. May 3, 1968, 82y 9m 27da', 'high'
FROM affected_entries WHERE parsed_position_number = 11
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. July 2, 1921, 59y', NULL::date, 'CR: d. July 2, 1921, 59y', 'review'
FROM affected_entries WHERE parsed_position_number = 13
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'July 2, 1921', DATE '1921-07-02', 'CR: d. July 2, 1921, 59y', 'high'
FROM affected_entries WHERE parsed_position_number = 13
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'd. October 14, 1926', NULL::date, 'CR: d. October 14, 1926', 'review'
FROM affected_entries WHERE parsed_position_number = 14
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'October 14, 1926', DATE '1926-10-14', 'CR: d. October 14, 1926', 'high'
FROM affected_entries WHERE parsed_position_number = 14
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 211 AND parsed_section_name = 'C' AND parsed_row_number = 11 AND parsed_position_number IN (8, 9, 10, 11, 13, 14)) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 211 AND parsed_section_name = 'C' AND parsed_row_number = 11 AND parsed_position_number IN (8, 9, 11, 13, 15);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
