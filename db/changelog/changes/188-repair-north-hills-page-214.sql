--liquibase formatted sql

--changeset cemeterymapping:188-repair-north-hills-page-214 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 214
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (3, 6, 'WALTERS/SANDROCK', ARRAY['WALTERS','SANDROCK']::text[], 13, 17, 'single', 'upright', 'granite', 'excellent',
        $nhg$WALTERS/SANDROCK {13C, 17, s) upright, gray granite, exc cond, ivy, cross "James W. / Walters / Husband / 1919-1973 / Helen S." CR: James, d. October 8, 1973, Clara Sandrock's sister-In-law's second husband. Helen, July 6, 1915 - June 3, 1998$nhg$,
        $nhg$James W. / Walters / Husband / 1919-1973 / Helen S.$nhg$,
        ARRAY[1915, 1919, 1973, 1998]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WALTERS/SANDROCK {13C, 17, s) upright, gray granite, exc cond, ivy, cross","descriptor":"upright, gray granite, exc cond, ivy, cross"}$json$::jsonb
      ),
      (28, 29, 'NULL', ARRAY['NULL']::text[], 14, 2, 'single', 'flat', 'bronze', 'excellent',
        $nhg$NULL (14C, 2, s) flat, bronze, exc cond, flower holder "Sara E. Null / Sept. 7, 1ai9 - May 13, 1936"$nhg$,
        $nhg$Sara E. Null / Sept. 7, 1ai9 - May 13, 1936$nhg$,
        ARRAY[1936]::integer[],
        ARRAY[]::text[],
        $json${"heading":"NULL (14C, 2, s) flat, bronze, exc cond, flower holder","descriptor":"flat, bronze, exc cond, flower holder"}$json$::jsonb
      ),
      (31, 32, 'NULL', ARRAY['NULL']::text[], 14, 3, 'single', 'flat', 'bronze', 'excellent',
        $nhg$NULL (14C, 3, s) flat, bronze, exc cond, flower holder "James W. Null / Feb. 3, 1881 - June 2, 1959" CR: Burled June 6, 78y 4m$nhg$,
        $nhg$James W. Null / Feb. 3, 1881 - June 2, 1959$nhg$,
        ARRAY[1881, 1959]::integer[],
        ARRAY[]::text[],
        $json${"heading":"NULL (14C, 3, s) flat, bronze, exc cond, flower holder","descriptor":"flat, bronze, exc cond, flower holder"}$json$::jsonb
      ),
      (34, 35, 'STEWART', ARRAY['STEWART']::text[], 14, 4, 'single', 'upright', 'granite', 'excellent',
        $nhg$STEWART (14C, 4, s) upright, gray granite, exc cond, flowers "Frederick B / Stewart / 1898-1945" CR: d. January 9, 1945$nhg$,
        $nhg$Frederick B / Stewart / 1898-1945$nhg$,
        ARRAY[1898, 1945]::integer[],
        ARRAY[]::text[],
        $json${"heading":"STEWART (14C, 4, s) upright, gray granite, exc cond, flowers","descriptor":"upright, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (37, 38, 'BERKSHIRE', ARRAY['BERKSHIRE']::text[], 14, 5, 'single', 'pillow', 'granite', 'excellent',
        $nhg$BERKSHIRE (14C, 5, s) pillow, gray granite, exc cond, flowers "Daughter / Barbara Sue / Berkshire / 1946-1949" CR: d, December 24, 1949, 2y 11m 24da$nhg$,
        $nhg$Daughter / Barbara Sue / Berkshire / 1946-1949$nhg$,
        ARRAY[1946, 1949]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BERKSHIRE (14C, 5, s) pillow, gray granite, exc cond, flowers","descriptor":"pillow, gray granite, exc cond, flowers"}$json$::jsonb
      ),
      (40, 42, 'CAPENOS', ARRAY['CAPENOS']::text[], 14, 6, 'single', 'upright', 'granite', 'excellent',
        $nhg$CAPENOS (14C, 6, s) upright, pink granite, exc cond, flowers "Father / John A. Capenos / April 5, 1910 / February 19, 1963" On back: "Capenos" CR: 52y 10m 14da, Councilman$nhg$,
        $nhg$Father / John A. Capenos / April 5, 1910 / February 19, 1963 Capenos$nhg$,
        ARRAY[1910, 1963]::integer[],
        ARRAY[]::text[],
        $json${"heading":"CAPENOS (14C, 6, s) upright, pink granite, exc cond, flowers","descriptor":"upright, pink granite, exc cond, flowers"}$json$::jsonb
      ),
      (44, 46, 'CAPENOS/HAGUE', ARRAY['CAPENOS','HAGUE']::text[], 14, 7, 'single', 'upright', 'granite', 'excellent',
        $nhg$CAPENOS/HAGUE (14C, 7, s) upright, pink granite, exc cond, flowers "Mother / E. Pearl Capenos / July 3, 1910 / May 7, 1977" CR: Evelyn Pearl Hague Capenos$nhg$,
        $nhg$Mother / E. Pearl Capenos / July 3, 1910 / May 7, 1977$nhg$,
        ARRAY[1910, 1977]::integer[],
        ARRAY['Gap, about 30 feet.']::text[],
        $json${"heading":"CAPENOS/HAGUE (14C, 7, s) upright, pink granite, exc cond, flowers","descriptor":"upright, pink granite, exc cond, flowers"}$json$::jsonb
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
    214,
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
      AND existing.source_page_number = 214
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
        13, 20, 15, 'STEINAUER', ARRAY['STEINAUER']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$STEINAUER (13C, 20, s) pillow, gray granite, exc cond "Charles / Steinauer / 1842-1904"$nhg$,
        $nhg$Charles / Steinauer / 1842-1904$nhg$,
        ARRAY[1842, 1904]::integer[],
        ARRAY[]::text[],
        $json${"heading":"STEINAUER (13C, 20, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        14, 1, 26, 'BRANDT', ARRAY['BRANDT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRANDT (14C, 1, c) upright, gray granite, exc cond, flower, leaves "Brandt / Herman P. / 1877-1936 / Allie H. / 1881-1972 / 1910 Ruth Anna 1913" On back: "Brandt" CR: Herman, d. September 7, 1936. Ruth Brandt burled Highland Presbyterian, daughter of H. P. Brandt. Note: No date on CR but listed In 1912-1913 period$nhg$,
        $nhg$Brandt / Herman P. / 1877-1936 / Allie H. / 1881-1972 / 1910 Ruth Anna 1913 Brandt$nhg$,
        ARRAY[1877, 1881, 1910, 1912, 1913, 1936, 1972]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT (14C, 1, c) upright, gray granite, exc cond, flower, leaves","descriptor":"upright, gray granite, exc cond, flower, leaves"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 214
    AND entry.parsed_section_name = 'C'
    AND entry.parsed_row_number = corrections.parsed_row_number
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
),
affected_entries AS (
  SELECT id
  FROM updated_entries
  UNION
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 214
    AND parsed_section_name = 'C'
    AND (
      (parsed_row_number = 13 AND parsed_position_number = 17)
      OR (parsed_row_number = 14 AND parsed_position_number IN (1, 3, 4, 5, 6, 7))
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (13, 17, 'CR', 'Church Records', 'death_date', 'October 8, 1973', DATE '1973-10-08', $nhg$CR: James, d. October 8, 1973, Clara Sandrock's sister-In-law's second husband. Helen, July 6, 1915 - June 3, 1998$nhg$, 'high'),
    (13, 17, 'CR', 'Church Records', 'death_date', 'June 3, 1998', DATE '1998-06-03', $nhg$CR: James, d. October 8, 1973, Clara Sandrock's sister-In-law's second husband. Helen, July 6, 1915 - June 3, 1998$nhg$, 'high'),
    (13, 17, 'CR', 'Church Records', 'note', $nhg$James, d. October 8, 1973, Clara Sandrock's sister-In-law's second husband. Helen, July 6, 1915 - June 3, 1998$nhg$, NULL::date, $nhg$CR: James, d. October 8, 1973, Clara Sandrock's sister-In-law's second husband. Helen, July 6, 1915 - June 3, 1998$nhg$, 'review'),
    (14, 1, 'CR', 'Church Records', 'death_date', 'September 7, 1936', DATE '1936-09-07', $nhg$CR: Herman, d. September 7, 1936. Ruth Brandt burled Highland Presbyterian, daughter of H. P. Brandt. Note: No date on CR but listed In 1912-1913 period$nhg$, 'high'),
    (14, 1, 'CR', 'Church Records', 'note', $nhg$Herman, d. September 7, 1936. Ruth Brandt burled Highland Presbyterian, daughter of H. P. Brandt. Note: No date on CR but listed In 1912-1913 period$nhg$, NULL::date, $nhg$CR: Herman, d. September 7, 1936. Ruth Brandt burled Highland Presbyterian, daughter of H. P. Brandt. Note: No date on CR but listed In 1912-1913 period$nhg$, 'review'),
    (14, 3, 'CR', 'Church Records', 'note', 'Burled June 6, 78y 4m', NULL::date, 'CR: Burled June 6, 78y 4m', 'review'),
    (14, 4, 'CR', 'Church Records', 'death_date', 'January 9, 1945', DATE '1945-01-09', 'CR: d. January 9, 1945', 'high'),
    (14, 4, 'CR', 'Church Records', 'note', 'd. January 9, 1945', NULL::date, 'CR: d. January 9, 1945', 'review'),
    (14, 5, 'CR', 'Church Records', 'death_date', 'December 24, 1949', DATE '1949-12-24', 'CR: d, December 24, 1949, 2y 11m 24da', 'high'),
    (14, 5, 'CR', 'Church Records', 'note', 'd, December 24, 1949, 2y 11m 24da', NULL::date, 'CR: d, December 24, 1949, 2y 11m 24da', 'review'),
    (14, 6, 'CR', 'Church Records', 'note', '52y 10m 14da, Councilman', NULL::date, 'CR: 52y 10m 14da, Councilman', 'review'),
    (14, 7, 'CR', 'Church Records', 'note', 'Evelyn Pearl Hague Capenos', NULL::date, 'CR: Evelyn Pearl Hague Capenos', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 214
  AND entry.parsed_section_name = 'C'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 214 AND parsed_section_name = 'C' AND ((parsed_row_number = 13 AND parsed_position_number IN (17, 20)) OR (parsed_row_number = 14 AND parsed_position_number IN (1, 2, 3, 4, 5, 6, 7)))) AND source_code = 'CR';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 214 AND parsed_section_name = 'C' AND ((parsed_row_number = 13 AND parsed_position_number = 17) OR (parsed_row_number = 14 AND parsed_position_number IN (2, 3, 4, 5, 6, 7)));
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
