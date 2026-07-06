--liquibase formatted sql

--changeset cemeterymapping:214-repair-north-hills-page-232 splitStatements:false
WITH updated_entries AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = GREATEST(entry.source_line_start, corrections.source_line_end),
    raw_text = corrections.raw_text,
    name_text = corrections.name_text,
    surnames = corrections.surnames,
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
        'E', 7, 2, 10, 'ECKE/ECKEY/GRAF', ARRAY['ECKE','ECKEY','GRAF']::text[], 'single', 'obelisk', 'metal', 'excellent',
        $nhg$ECKE/ECKEY/GRAF (7E, 2, s) obelisk, gray metal, exc cond, rose on front, lamb on left side, shield with dove & angels on right side, lily on rear. On front: "Infant son / of / Robert & Anne M / Ecke / died Jan. 18, 1877 / Ecke" On left: "We careth for / the lambs." On right: "Our darling / safe, / safe at home" On back: "Suffer little / children / to come unto Me / 1880" CRG: Eckey, little son of Robert Eckey and Anna Margaretha nee Graf, f. January 30, 1877, b. January 28, 1877 at 8:30 am, died after 10 hours$nhg$,
        $nhg$Infant son / of / Robert & Anne M / Ecke / died Jan. 18, 1877 / Ecke We careth for / the lambs. Our darling / safe, / safe at home Suffer little / children / to come unto Me / 1880$nhg$,
        ARRAY[1877, 1880]::integer[],
        ARRAY[]::text[],
        $json${"heading":"ECKE/ECKEY/GRAF (7E, 2, s) obelisk, gray metal, exc cond, rose on front, lamb on left side, shield with dove & angels on right side, lily on rear","descriptor":"obelisk, gray metal, exc cond, rose on front, lamb on left side, shield with dove & angels on right side, lily on rear"}$json$::jsonb
      ),
      (
        'E', 7, 3, 12, 'UNKNOWN', ARRAY['UNKNOWN']::text[], 'single', 'upright', 'marble', NULL::varchar,
        $nhg$UNKNOWN (7E, 3, s) upright, white marble, illegible, lamb$nhg$,
        $nhg$$nhg$,
        ARRAY[]::integer[],
        ARRAY['Illegible inscription.']::text[],
        $json${"heading":"UNKNOWN (7E, 3, s) upright, white marble, illegible, lamb","descriptor":"upright, white marble, illegible, lamb"}$json$::jsonb
      ),
      (
        'E', 7, 5, 20, 'GRAFF/GRAF', ARRAY['GRAFF','GRAF']::text[], 'single', 'upright, ledger', 'granite', 'excellent',
        $nhg$GRAFF/GRAF (7E, 5, s) upright with barrel-shaped ledger, gray granite, exc cond "J. Mlchael Graff/ 1820-1867" CRG: Graf, Johann Michael, b. Seib, Bavaria, d. 3 November 1867, 46y, 10m, 18da, f. November 5$nhg$,
        $nhg$J. Mlchael Graff/ 1820-1867$nhg$,
        ARRAY[1820, 1867]::integer[],
        ARRAY[]::text[],
        $json${"heading":"GRAFF/GRAF (7E, 5, s) upright with barrel-shaped ledger, gray granite, exc cond","descriptor":"upright with barrel-shaped ledger, gray granite, exc cond"}$json$::jsonb
      ),
      (
        'E', 7, 6, 26, 'GRAFF/GRAF/METZ', ARRAY['GRAFF','GRAF','METZ']::text[], 'single', 'upright, ledger', 'granite', 'excellent',
        $nhg$GRAFF/GRAF/METZ (7E, 6, s) upright with barrel-shaped ledger, small-size, gray granite, exc cond "Elizabeth Graff / 1866-1867" CRG: Elisabeth Graf, little daughter of Michael and Anna Margarethe nee Metz, d. 29 September 1867 4 a. m., 2y 8m 18da, f. September 30$nhg$,
        $nhg$Elizabeth Graff / 1866-1867$nhg$,
        ARRAY[1866, 1867]::integer[],
        ARRAY[]::text[],
        $json${"heading":"GRAFF/GRAF/METZ (7E, 6, s) upright with barrel-shaped ledger, small-size, gray granite, exc cond","descriptor":"upright with barrel-shaped ledger, small-size, gray granite, exc cond"}$json$::jsonb
      ),
      (
        'E', 7, 8, 37, 'SHARF/SCHARF', ARRAY['SHARF','SCHARF']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$SHARF/SCHARF (7E, 8, s) upright white marble, poor cond, sunken, fallen, rose "Hire ruhet in Gott / Catharina C. Sharf / geboren / 10 Jan 1803 / gestorben 6 Dec. 1877 / alter 74 jahren / m u d 26 tagen" CRG: Catharina, wife of the deceased Georg Adam Scharf who died 5 December 1864, b. 10 January 1803 Felden, Kingdom of Bavaria, f. December 8, 1877, d. 6 December at 7 am, 74y 11m 6da$nhg$,
        $nhg$Hire ruhet in Gott / Catharina C. Sharf / geboren / 10 Jan 1803 / gestorben 6 Dec. 1877 / alter 74 jahren / m u d 26 tagen$nhg$,
        ARRAY[1803, 1864, 1877]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SHARF/SCHARF (7E, 8, s) upright white marble, poor cond, sunken, fallen, rose","descriptor":"upright white marble, poor cond, sunken, fallen, rose"}$json$::jsonb
      ),
      (
        'E', 7, 9, 44, 'SCHMELTZ/SCHMELZ/SCHUSTER', ARRAY['SCHMELTZ','SCHMELZ','SCHUSTER']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$SCHMELTZ/SCHMELZ/SCHUSTER (7E, 9, s) upright, white marble, poor cond, sunken, fallen, weeping willow "Anna D. Schmeltz / gestorben / d. 8 Juli 1868 / ln alter von / 70 Jahren / [broken]" Note: Same round top design as stones (7E, 7) and (7E, 8). CRG: Dorthea Schmelz nee Schuster, b. Connefeld, Kreis Melsungen, Hessen Cassel, f. July 9, 1868, d. 8 July$nhg$,
        $nhg$Anna D. Schmeltz / gestorben / d. 8 Juli 1868 / ln alter von / 70 Jahren / [broken]$nhg$,
        ARRAY[1868]::integer[],
        ARRAY['Same round top design as stones (7E, 7) and (7E, 8).']::text[],
        $json${"heading":"SCHMELTZ/SCHMELZ/SCHUSTER (7E, 9, s) upright, white marble, poor cond, sunken, fallen, weeping willow","descriptor":"upright, white marble, poor cond, sunken, fallen, weeping willow"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 232
    AND entry.parsed_section_name = corrections.parsed_section_name
    AND entry.parsed_row_number = corrections.parsed_row_number
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
)
SELECT count(*) FROM updated_entries;

WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 232
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
    232,
    46,
    49,
    $nhg$TRAUT/SPANKNEBEL (8E, 1, s) upright, gray granite, exc cond, fallen "T / Martha E. / wife of / William Traut/ born Dec, 14, 1829 / died June 18, 1886" CRG: Traut, Martha Elisabeth nee Spanknebel, wife of Wilhelm, b. 1829, f. June 20, 18861 d. 18 June, 56y 5m 29da$nhg$,
    'TRAUT/SPANKNEBEL',
    ARRAY['TRAUT','SPANKNEBEL']::text[],
    'E',
    8,
    1,
    'single',
    'upright',
    'granite',
    'excellent',
    $nhg$T / Martha E. / wife of / William Traut/ born Dec, 14, 1829 / died June 18, 1886$nhg$,
    ARRAY[1829, 1886]::integer[],
    'high',
    ARRAY[]::text[],
    $json${"heading":"TRAUT/SPANKNEBEL (8E, 1, s) upright, gray granite, exc cond, fallen","descriptor":"upright, gray granite, exc cond, fallen"}$json$::jsonb
  FROM page_batches
  WHERE NOT EXISTS (
    SELECT 1
    FROM north_hills_ocr_entries existing
    WHERE existing.batch_id = page_batches.batch_id
      AND existing.source_page_index = page_batches.source_page_index
      AND existing.source_page_number = 232
      AND existing.parsed_section_name = 'E'
      AND existing.parsed_row_number = 8
      AND existing.parsed_position_number = 1
      AND existing.name_text = 'TRAUT/SPANKNEBEL'
  )
  ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING
  RETURNING id
)
SELECT count(*) FROM inserted_missing;

WITH affected_entries AS (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 232
    AND parsed_section_name = 'E'
    AND (
      (parsed_row_number = 7 AND parsed_position_number IN (2, 5, 6, 8, 9))
      OR (parsed_row_number = 8 AND parsed_position_number = 1)
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code = 'CRG'
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('E', 7, 2, 'CRG', 'Church Records in German', 'note', 'Eckey, little son of Robert Eckey and Anna Margaretha nee Graf, f. January 30, 1877, b. January 28, 1877 at 8:30 am, died after 10 hours', NULL::date, 'CRG: Eckey, little son of Robert Eckey and Anna Margaretha nee Graf, f. January 30, 1877, b. January 28, 1877 at 8:30 am, died after 10 hours', 'review'),
    ('E', 7, 5, 'CRG', 'Church Records in German', 'death_date', 'November 3, 1867', DATE '1867-11-03', 'CRG: Graf, Johann Michael, b. Seib, Bavaria, d. 3 November 1867, 46y, 10m, 18da, f. November 5', 'high'),
    ('E', 7, 5, 'CRG', 'Church Records in German', 'age_at_death', '46y 10m 18d', NULL::date, 'CRG: Graf, Johann Michael, b. Seib, Bavaria, d. 3 November 1867, 46y, 10m, 18da, f. November 5', 'medium'),
    ('E', 7, 5, 'CRG', 'Church Records in German', 'note', 'Graf, Johann Michael, b. Seib, Bavaria, d. 3 November 1867, 46y, 10m, 18da, f. November 5', NULL::date, 'CRG: Graf, Johann Michael, b. Seib, Bavaria, d. 3 November 1867, 46y, 10m, 18da, f. November 5', 'review'),
    ('E', 7, 6, 'CRG', 'Church Records in German', 'death_date', 'September 29, 1867', DATE '1867-09-29', 'CRG: Elisabeth Graf, little daughter of Michael and Anna Margarethe nee Metz, d. 29 September 1867 4 a. m., 2y 8m 18da, f. September 30', 'high'),
    ('E', 7, 6, 'CRG', 'Church Records in German', 'age_at_death', '2y 8m 18d', NULL::date, 'CRG: Elisabeth Graf, little daughter of Michael and Anna Margarethe nee Metz, d. 29 September 1867 4 a. m., 2y 8m 18da, f. September 30', 'medium'),
    ('E', 7, 6, 'CRG', 'Church Records in German', 'note', 'Elisabeth Graf, little daughter of Michael and Anna Margarethe nee Metz, d. 29 September 1867 4 a. m., 2y 8m 18da, f. September 30', NULL::date, 'CRG: Elisabeth Graf, little daughter of Michael and Anna Margarethe nee Metz, d. 29 September 1867 4 a. m., 2y 8m 18da, f. September 30', 'review'),
    ('E', 7, 8, 'CRG', 'Church Records in German', 'death_date', 'December 6, 1877', DATE '1877-12-06', 'CRG: Catharina, wife of the deceased Georg Adam Scharf who died 5 December 1864, b. 10 January 1803 Felden, Kingdom of Bavaria, f. December 8, 1877, d. 6 December at 7 am, 74y 11m 6da', 'high'),
    ('E', 7, 8, 'CRG', 'Church Records in German', 'age_at_death', '74y 11m 6d', NULL::date, 'CRG: Catharina, wife of the deceased Georg Adam Scharf who died 5 December 1864, b. 10 January 1803 Felden, Kingdom of Bavaria, f. December 8, 1877, d. 6 December at 7 am, 74y 11m 6da', 'medium'),
    ('E', 7, 8, 'CRG', 'Church Records in German', 'note', 'Catharina, wife of the deceased Georg Adam Scharf who died 5 December 1864, b. 10 January 1803 Felden, Kingdom of Bavaria, f. December 8, 1877, d. 6 December at 7 am, 74y 11m 6da', NULL::date, 'CRG: Catharina, wife of the deceased Georg Adam Scharf who died 5 December 1864, b. 10 January 1803 Felden, Kingdom of Bavaria, f. December 8, 1877, d. 6 December at 7 am, 74y 11m 6da', 'review'),
    ('E', 7, 9, 'CRG', 'Church Records in German', 'note', 'Dorthea Schmelz nee Schuster, b. Connefeld, Kreis Melsungen, Hessen Cassel, f. July 9, 1868, d. 8 July', NULL::date, 'CRG: Dorthea Schmelz nee Schuster, b. Connefeld, Kreis Melsungen, Hessen Cassel, f. July 9, 1868, d. 8 July', 'review'),
    ('E', 8, 1, 'CRG', 'Church Records in German', 'death_date', 'June 18, 1886', DATE '1886-06-18', 'CRG: Traut, Martha Elisabeth nee Spanknebel, wife of Wilhelm, b. 1829, f. June 20, 18861 d. 18 June, 56y 5m 29da', 'high'),
    ('E', 8, 1, 'CRG', 'Church Records in German', 'age_at_death', '56y 5m 29d', NULL::date, 'CRG: Traut, Martha Elisabeth nee Spanknebel, wife of Wilhelm, b. 1829, f. June 20, 18861 d. 18 June, 56y 5m 29da', 'medium'),
    ('E', 8, 1, 'CRG', 'Church Records in German', 'note', 'Traut, Martha Elisabeth nee Spanknebel, wife of Wilhelm, b. 1829, f. June 20, 18861 d. 18 June, 56y 5m 29da', NULL::date, 'CRG: Traut, Martha Elisabeth nee Spanknebel, wife of Wilhelm, b. 1829, f. June 20, 18861 d. 18 June, 56y 5m 29da', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 232
  AND entry.parsed_section_name = 'E'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 232 AND parsed_section_name = 'E' AND ((parsed_row_number = 7 AND parsed_position_number IN (2, 5, 6, 8, 9)) OR (parsed_row_number = 8 AND parsed_position_number = 1))) AND source_code = 'CRG';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 232 AND parsed_section_name = 'E' AND parsed_row_number = 8 AND parsed_position_number = 1 AND name_text = 'TRAUT/SPANKNEBEL';
