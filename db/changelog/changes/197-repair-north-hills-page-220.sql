--liquibase formatted sql

--changeset cemeterymapping:197-repair-north-hills-page-220 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 220
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        17, 17, 'McCANDLESS/SOERGEL', ARRAY['MCCANDLESS','SOERGEL']::text[], 'C', 17, 15, 'single', 'upright', 'granite', 'excellent',
        $nhg$McCANDLESS/SOERGEL (17C, 15, s) upright, gray granite, exc cond, flower "Mabel Soergel / McCandless / 1903-1994" CR: March 9, 1903 - October 3, 1994, Kings Funeral Home$nhg$,
        $nhg$Mabel Soergel / McCandless / 1903-1994$nhg$,
        ARRAY[1903, 1994]::integer[],
        ARRAY[]::text[],
        $json${"heading":"McCANDLESS/SOERGEL (17C, 15, s) upright, gray granite, exc cond, flower","descriptor":"upright, gray granite, exc cond, flower"}$json$::jsonb
      ),
      (
        36, 51, 'MAYER/ENSMIGER/MÖYER/ENZINGER/LEONARD/EMSINGER', ARRAY['MAYER','ENSMIGER','MÖYER','ENZINGER','LEONARD','EMSINGER']::text[], 'D', 1, 2, 'couple', 'obelisk', 'granite', 'good',
        $nhg$MAYER/ENSMIGER/MÖYER/ENZINGER/LEONARD/EMSINGER (1D, 2, c) obelisk, gray granite, good cond, urn with drape on top, geometric pattern on sides  On front: "Geo. G. Mayer. / geb. / 31. Aug. 1831. / gest. / 6. Jan. 1901. / Magd. Mayer/ geb. / 23. Aug, 1841. / gest. / 29. Dec. 1915." On base: ''G. G. Mayer" On left: "Friederich Phil, / Mayer. / geb. / 12 Dez. 1862 / gest. / 12 Jan. 1875. / Heinrich / Ensmiger. / geb. / 4 Martz 1873 / gest. / 12 Jan. 1875." On right: "Margaretha/ Ensmiger. / geb. / 12 Martz 1812 / gest. 22 Jan. 1876. / Philip / Ensmiger. / geb. / 11 Dez. 1812 / gest. / 19 April 1890." On back: [blank]  CR: Mrs. George G. Mayer, d. December 29, 1915, 73y. CRG: Philip Friedrich Möyer, son of George Gottlieb & Magdalena Moyer, f. January 14, 1875, d. 12 January 1875, 12y 1m 9 hours. Johannes Heinrich Enzminger, little son of George & Hariette nee Leonard, f. January 14, 1875, d. 12 January, 22m 4da. Maria Enzminger, wife of Georg, from Petersbach Canton Littelestein Alsace, f. 1876, near 64y. Philipp Emsinger b. 12 December 1812 In Aveiler in Alsace, d. 19 April 1890, 77y 7m 7 da, f. April 21, 1890$nhg$,
        $nhg$Geo. G. Mayer. / geb. / 31. Aug. 1831. / gest. / 6. Jan. 1901. / Magd. Mayer/ geb. / 23. Aug, 1841. / gest. / 29. Dec. 1915. G. G. Mayer Friederich Phil, / Mayer. / geb. / 12 Dez. 1862 / gest. / 12 Jan. 1875. / Heinrich / Ensmiger. / geb. / 4 Martz 1873 / gest. / 12 Jan. 1875. Margaretha/ Ensmiger. / geb. / 12 Martz 1812 / gest. 22 Jan. 1876. / Philip / Ensmiger. / geb. / 11 Dez. 1812 / gest. / 19 April 1890. On back: [blank]$nhg$,
        ARRAY[1812, 1831, 1841, 1862, 1873, 1875, 1876, 1890, 1901, 1915]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER/ENSMIGER/MÖYER/ENZINGER/LEONARD/EMSINGER (1D, 2, c) obelisk, gray granite, good cond, urn with drape on top, geometric pattern on sides","descriptor":"obelisk, gray granite, good cond, urn with drape on top, geometric pattern on sides"}$json$::jsonb
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
    220,
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
      AND existing.source_page_number = 220
      AND existing.parsed_section_name = entry_values.parsed_section_name
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
    parsed_section_name = corrections.parsed_section_name,
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
        'C'::varchar, 17, 14, 16, 'STETTLER', ARRAY['STETTLER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$STETTLER (17C, 14, s) upright, gray granite, exc cond, flower "Husband / George T. Stettler / 1896-1951" CR: d. October 7, 1951, 55y 7m 22da$nhg$,
        $nhg$Husband / George T. Stettler / 1896-1951$nhg$,
        ARRAY[1896, 1951]::integer[],
        ARRAY[]::text[],
        $json${"heading":"STETTLER (17C, 14, s) upright, gray granite, exc cond, flower","descriptor":"upright, gray granite, exc cond, flower"}$json$::jsonb
      ),
      (
        'C'::varchar, 17, 15, 17, 'McCANDLESS/SOERGEL', ARRAY['MCCANDLESS','SOERGEL']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$McCANDLESS/SOERGEL (17C, 15, s) upright, gray granite, exc cond, flower "Mabel Soergel / McCandless / 1903-1994" CR: March 9, 1903 - October 3, 1994, Kings Funeral Home$nhg$,
        $nhg$Mabel Soergel / McCandless / 1903-1994$nhg$,
        ARRAY[1903, 1994]::integer[],
        ARRAY[]::text[],
        $json${"heading":"McCANDLESS/SOERGEL (17C, 15, s) upright, gray granite, exc cond, flower","descriptor":"upright, gray granite, exc cond, flower"}$json$::jsonb
      ),
      (
        'C'::varchar, 17, 16, 22, 'SARVER/STEELE', ARRAY['SARVER','STEELE']::text[], 'couple', 'flat', 'bronze', 'excellent',
        $nhg$SARVER/STEELE (17C, 16, c) flat, bronze, exc cond, roses, wheat "Sarver / Howard L. / 1894-1962 / Ellen C. / 1898-1966 / Together forever" CR: Howard, d. September 1, 1962, 68y 30da, Bertie Steele's brother.  Ellen Clara, d. November 3, 1966, 68y 6m 16da$nhg$,
        $nhg$Sarver / Howard L. / 1894-1962 / Ellen C. / 1898-1966 / Together forever$nhg$,
        ARRAY[1894, 1898, 1962, 1966]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SARVER/STEELE (17C, 16, c) flat, bronze, exc cond, roses, wheat","descriptor":"flat, bronze, exc cond, roses, wheat"}$json$::jsonb
      ),
      (
        'C'::varchar, 18, 1, 28, 'BRASSES', ARRAY['BRASSES']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRASSES (18C, 1, c) upright, gray & pink granite, exc cond "Brasses / Paul J. / 1890-1950 / Alice M. / 1884-1974" On back: "Brasses" CR: Middle name John, d. March 17, 1950, 60y 26da. Alice, d. April 9, 1974, 90y 1m 11da$nhg$,
        $nhg$Brasses / Paul J. / 1890-1950 / Alice M. / 1884-1974 On back: Brasses$nhg$,
        ARRAY[1884, 1890, 1950, 1974]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRASSES (18C, 1, c) upright, gray & pink granite, exc cond","descriptor":"upright, gray & pink granite, exc cond"}$json$::jsonb
      ),
      (
        'D'::varchar, 1, 1, 35, 'MAYER', ARRAY['MAYER']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$MAYER (1D, 1, s) upright, gray granite, exc cond "Father / Geo. C. Mayer'' Separate flag holder: "American / US / Legion", star SK: George G.$nhg$,
        $nhg$Father / Geo. C. Mayer American / US / Legion George G.$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER (1D, 1, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        'D'::varchar, 1, 2, 51, 'MAYER/ENSMIGER/MÖYER/ENZINGER/LEONARD/EMSINGER', ARRAY['MAYER','ENSMIGER','MÖYER','ENZINGER','LEONARD','EMSINGER']::text[], 'couple', 'obelisk', 'granite', 'good',
        $nhg$MAYER/ENSMIGER/MÖYER/ENZINGER/LEONARD/EMSINGER (1D, 2, c) obelisk, gray granite, good cond, urn with drape on top, geometric pattern on sides  On front: "Geo. G. Mayer. / geb. / 31. Aug. 1831. / gest. / 6. Jan. 1901. / Magd. Mayer/ geb. / 23. Aug, 1841. / gest. / 29. Dec. 1915." On base: ''G. G. Mayer" On left: "Friederich Phil, / Mayer. / geb. / 12 Dez. 1862 / gest. / 12 Jan. 1875. / Heinrich / Ensmiger. / geb. / 4 Martz 1873 / gest. / 12 Jan. 1875." On right: "Margaretha/ Ensmiger. / geb. / 12 Martz 1812 / gest. 22 Jan. 1876. / Philip / Ensmiger. / geb. / 11 Dez. 1812 / gest. / 19 April 1890." On back: [blank]  CR: Mrs. George G. Mayer, d. December 29, 1915, 73y. CRG: Philip Friedrich Möyer, son of George Gottlieb & Magdalena Moyer, f. January 14, 1875, d. 12 January 1875, 12y 1m 9 hours. Johannes Heinrich Enzminger, little son of George & Hariette nee Leonard, f. January 14, 1875, d. 12 January, 22m 4da. Maria Enzminger, wife of Georg, from Petersbach Canton Littelestein Alsace, f. 1876, near 64y. Philipp Emsinger b. 12 December 1812 In Aveiler in Alsace, d. 19 April 1890, 77y 7m 7 da, f. April 21, 1890$nhg$,
        $nhg$Geo. G. Mayer. / geb. / 31. Aug. 1831. / gest. / 6. Jan. 1901. / Magd. Mayer/ geb. / 23. Aug, 1841. / gest. / 29. Dec. 1915. G. G. Mayer Friederich Phil, / Mayer. / geb. / 12 Dez. 1862 / gest. / 12 Jan. 1875. / Heinrich / Ensmiger. / geb. / 4 Martz 1873 / gest. / 12 Jan. 1875. Margaretha/ Ensmiger. / geb. / 12 Martz 1812 / gest. 22 Jan. 1876. / Philip / Ensmiger. / geb. / 11 Dez. 1812 / gest. / 19 April 1890. On back: [blank]$nhg$,
        ARRAY[1812, 1831, 1841, 1862, 1873, 1875, 1876, 1890, 1901, 1915]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MAYER/ENSMIGER/MÖYER/ENZINGER/LEONARD/EMSINGER (1D, 2, c) obelisk, gray granite, good cond, urn with drape on top, geometric pattern on sides","descriptor":"obelisk, gray granite, good cond, urn with drape on top, geometric pattern on sides"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 220
    AND entry.parsed_section_name = corrections.parsed_section_name
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
  WHERE source_page_number = 220
    AND (
      (parsed_section_name = 'C' AND parsed_row_number = 17 AND parsed_position_number IN (14, 15, 16))
      OR (parsed_section_name = 'C' AND parsed_row_number = 18 AND parsed_position_number = 1)
      OR (parsed_section_name = 'D' AND parsed_row_number = 1 AND parsed_position_number IN (1, 2))
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code IN ('CR', 'CRG')
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('C', 17, 14, 'CR', 'Church Records', 'death_date', 'October 7, 1951', DATE '1951-10-07', 'CR: d. October 7, 1951, 55y 7m 22da', 'high'),
    ('C', 17, 14, 'CR', 'Church Records', 'note', 'd. October 7, 1951, 55y 7m 22da', NULL::date, 'CR: d. October 7, 1951, 55y 7m 22da', 'review'),
    ('C', 17, 15, 'CR', 'Church Records', 'death_date', 'October 3, 1994', DATE '1994-10-03', 'CR: March 9, 1903 - October 3, 1994, Kings Funeral Home', 'high'),
    ('C', 17, 15, 'CR', 'Church Records', 'note', 'March 9, 1903 - October 3, 1994, Kings Funeral Home', NULL::date, 'CR: March 9, 1903 - October 3, 1994, Kings Funeral Home', 'review'),
    ('C', 17, 16, 'CR', 'Church Records', 'death_date', 'September 1, 1962', DATE '1962-09-01', 'CR: Howard, d. September 1, 1962, 68y 30da, Bertie Steele''s brother.  Ellen Clara, d. November 3, 1966, 68y 6m 16da', 'high'),
    ('C', 17, 16, 'CR', 'Church Records', 'death_date', 'November 3, 1966', DATE '1966-11-03', 'CR: Howard, d. September 1, 1962, 68y 30da, Bertie Steele''s brother.  Ellen Clara, d. November 3, 1966, 68y 6m 16da', 'high'),
    ('C', 17, 16, 'CR', 'Church Records', 'note', 'Howard, d. September 1, 1962, 68y 30da, Bertie Steele''s brother. Ellen Clara, d. November 3, 1966, 68y 6m 16da', NULL::date, 'CR: Howard, d. September 1, 1962, 68y 30da, Bertie Steele''s brother.  Ellen Clara, d. November 3, 1966, 68y 6m 16da', 'review'),
    ('C', 18, 1, 'CR', 'Church Records', 'death_date', 'March 17, 1950', DATE '1950-03-17', 'CR: Middle name John, d. March 17, 1950, 60y 26da. Alice, d. April 9, 1974, 90y 1m 11da', 'high'),
    ('C', 18, 1, 'CR', 'Church Records', 'death_date', 'April 9, 1974', DATE '1974-04-09', 'CR: Middle name John, d. March 17, 1950, 60y 26da. Alice, d. April 9, 1974, 90y 1m 11da', 'high'),
    ('C', 18, 1, 'CR', 'Church Records', 'note', 'Middle name John, d. March 17, 1950, 60y 26da. Alice, d. April 9, 1974, 90y 1m 11da', NULL::date, 'CR: Middle name John, d. March 17, 1950, 60y 26da. Alice, d. April 9, 1974, 90y 1m 11da', 'review'),
    ('D', 1, 2, 'CR', 'Church Records', 'death_date', 'December 29, 1915', DATE '1915-12-29', 'CR: Mrs. George G. Mayer, d. December 29, 1915, 73y.', 'high'),
    ('D', 1, 2, 'CR', 'Church Records', 'note', 'Mrs. George G. Mayer, d. December 29, 1915, 73y.', NULL::date, 'CR: Mrs. George G. Mayer, d. December 29, 1915, 73y.', 'review'),
    ('D', 1, 2, 'CRG', 'Church Records in German', 'death_date', 'January 12, 1875', DATE '1875-01-12', 'CRG: Philip Friedrich Möyer, son of George Gottlieb & Magdalena Moyer, f. January 14, 1875, d. 12 January 1875, 12y 1m 9 hours. Johannes Heinrich Enzminger, little son of George & Hariette nee Leonard, f. January 14, 1875, d. 12 January, 22m 4da. Maria Enzminger, wife of Georg, from Petersbach Canton Littelestein Alsace, f. 1876, near 64y. Philipp Emsinger b. 12 December 1812 In Aveiler in Alsace, d. 19 April 1890, 77y 7m 7 da, f. April 21, 1890', 'high'),
    ('D', 1, 2, 'CRG', 'Church Records in German', 'death_date', 'April 19, 1890', DATE '1890-04-19', 'CRG: Philip Friedrich Möyer, son of George Gottlieb & Magdalena Moyer, f. January 14, 1875, d. 12 January 1875, 12y 1m 9 hours. Johannes Heinrich Enzminger, little son of George & Hariette nee Leonard, f. January 14, 1875, d. 12 January, 22m 4da. Maria Enzminger, wife of Georg, from Petersbach Canton Littelestein Alsace, f. 1876, near 64y. Philipp Emsinger b. 12 December 1812 In Aveiler in Alsace, d. 19 April 1890, 77y 7m 7 da, f. April 21, 1890', 'high'),
    ('D', 1, 2, 'CRG', 'Church Records in German', 'note', 'Philip Friedrich Möyer, son of George Gottlieb & Magdalena Moyer, f. January 14, 1875, d. 12 January 1875, 12y 1m 9 hours. Johannes Heinrich Enzminger, little son of George & Hariette nee Leonard, f. January 14, 1875, d. 12 January, 22m 4da. Maria Enzminger, wife of Georg, from Petersbach Canton Littelestein Alsace, f. 1876, near 64y. Philipp Emsinger b. 12 December 1812 In Aveiler in Alsace, d. 19 April 1890, 77y 7m 7 da, f. April 21, 1890', NULL::date, 'CRG: Philip Friedrich Möyer, son of George Gottlieb & Magdalena Moyer, f. January 14, 1875, d. 12 January 1875, 12y 1m 9 hours. Johannes Heinrich Enzminger, little son of George & Hariette nee Leonard, f. January 14, 1875, d. 12 January, 22m 4da. Maria Enzminger, wife of Georg, from Petersbach Canton Littelestein Alsace, f. 1876, near 64y. Philipp Emsinger b. 12 December 1812 In Aveiler in Alsace, d. 19 April 1890, 77y 7m 7 da, f. April 21, 1890', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 220
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 220 AND ((parsed_section_name = 'C' AND ((parsed_row_number = 17 AND parsed_position_number IN (14, 15, 16)) OR (parsed_row_number = 18 AND parsed_position_number = 1))) OR (parsed_section_name = 'D' AND parsed_row_number = 1 AND parsed_position_number IN (1, 2)))) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 220 AND ((parsed_section_name = 'C' AND parsed_row_number = 17 AND parsed_position_number = 15 AND name_text = 'McCANDLESS/SOERGEL') OR (parsed_section_name = 'D' AND parsed_row_number = 1 AND parsed_position_number = 2));
