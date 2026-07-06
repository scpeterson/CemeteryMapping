--liquibase formatted sql

--changeset cemeterymapping:213-repair-north-hills-page-231 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 231
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        2, 3, 'HECK', ARRAY['HECK']::text[], 'E', 6, 4, 'single', 'upright', 'marble', 'poor',
        $nhg$HECK (6E, 4, s) upright, white marble, poor cond, sunken, fallen, lamb "[-] / Heck / geb. 26 [-] / gest. 6 Juni [-] / [illegible lines]"$nhg$,
        $nhg$[-] / Heck / geb. 26 [-] / gest. 6 Juni [-] / [illegible lines]$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HECK (6E, 4, s) upright, white marble, poor cond, sunken, fallen, lamb","descriptor":"upright, white marble, poor cond, sunken, fallen, lamb"}$json$::jsonb
      ),
      (
        5, 7, 'UNKNOWN', ARRAY['UNKNOWN']::text[], 'E', 6, 5, 'single', 'upright', 'marble', 'poor',
        $nhg$UNKNOWN (6E, 5, s) upright, white marble, poor cond, fallen, lamb "[-] / Hier ruht in gott / Johann / sohn von / W. u C. [-] / gest. d. 2 Aug(?) 1871 or 4 / alter von / mn. U. 7"$nhg$,
        $nhg$[-] / Hier ruht in gott / Johann / sohn von / W. u C. [-] / gest. d. 2 Aug(?) 1871 or 4 / alter von / mn. U. 7$nhg$,
        ARRAY[1871]::integer[],
        ARRAY[]::text[],
        $json${"heading":"UNKNOWN (6E, 5, s) upright, white marble, poor cond, fallen, lamb","descriptor":"upright, white marble, poor cond, fallen, lamb"}$json$::jsonb
      ),
      (
        34, 37, 'KÖENIG', ARRAY['KÖENIG']::text[], 'E', 6, 12, 'couple', 'obelisk', 'granite', 'excellent',
        $nhg$KÖENIG (6E, 12, c} obelisk, gray granite, exc cond. On front "Der todt kommt / nicht zu frueh zu / dennen die bereited / sind / Köenig" On left "Nicholas / Köenig / gestorben / D. 14, Sep. 1857 / im alter von / 46 Jahren / U. 7 monate" On right: "Margareta / Köenig / gestorben / d. 9 Sept. 1882 / im alter von / 67 Jahren / 2 mo. U. 25 tage"$nhg$,
        $nhg$Der todt kommt / nicht zu frueh zu / dennen die bereited / sind / Köenig Nicholas / Köenig / gestorben / D. 14, Sep. 1857 / im alter von / 46 Jahren / U. 7 monate Margareta / Köenig / gestorben / d. 9 Sept. 1882 / im alter von / 67 Jahren / 2 mo. U. 25 tage$nhg$,
        ARRAY[1857, 1882]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KÖENIG (6E, 12, c) obelisk, gray granite, exc cond","descriptor":"obelisk, gray granite, exc cond"}$json$::jsonb
      ),
      (
        38, 39, 'UNKNOWN', ARRAY['UNKNOWN']::text[], 'E', 6, 13, 'single', 'upright', 'marble', NULL::varchar,
        $nhg$UNKNOWN (6E, 13, s) upright, white marble, illegible$nhg$,
        $nhg$$nhg$,
        ARRAY[]::integer[],
        ARRAY['Illegible inscription.']::text[],
        $json${"heading":"UNKNOWN (6E, 13, s) upright, white marble, illegible","descriptor":"upright, white marble, illegible"}$json$::jsonb
      ),
      (
        41, 47, 'GRAFF/GRAF', ARRAY['GRAFF','GRAF']::text[], 'E', 7, 1, 'single', 'obelisk', 'metal', 'excellent',
        $nhg$GRAFF/GRAF (7E, 1, s) obelisk, gray metal, exc cond, loose on base, rose on front and back, upright hand & lamb on left side, dove on right side. On front "Sarah / M. / daughter / of / Geo. A & Mary A / Graff / died Oct. 7. 1878 / aged 3 yrs. 3 mos. / Graff" On left: "Our darling / safely resting" On right: "Gone but / not forgotten / He doeth all things well" On back: "We shall / meet again / 1880" Note: A broken piece of metal was found beside base "M.G." CRG: Graf, Sarah Margareta, b. 9 July 1876 in McCandless Township, Allegheny Co. PA, f. October 8, 1879, d. October 7 at 8:30 in the morning, 3 y+$nhg$,
        $nhg$Sarah / M. / daughter / of / Geo. A & Mary A / Graff / died Oct. 7. 1878 / aged 3 yrs. 3 mos. / Graff Our darling / safely resting Gone but / not forgotten / He doeth all things well We shall / meet again / 1880 M.G.$nhg$,
        ARRAY[1876, 1878, 1879, 1880]::integer[],
        ARRAY['A broken piece of metal was found beside base "M.G.".']::text[],
        $json${"heading":"GRAFF/GRAF (7E, 1, s) obelisk, gray metal, exc cond, loose on base, rose on front and back, upright hand & lamb on left side, dove on right side","descriptor":"obelisk, gray metal, exc cond, loose on base, rose on front and back, upright hand & lamb on left side, dove on right side"}$json$::jsonb
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
    231,
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
      AND existing.source_page_number = 231
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
    source_line_end = GREATEST(entry.source_line_start, corrections.source_line_end),
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
        'E', 6, 7, 16, 'BRANT', ARRAY['BRANT']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$BRANT (6E, 7, s) upright, white marble, poor cond "Heinrich Brant / geboren den 29 Feb / 1773 / gest. den 14 Feb. 1849 / unalter von 75 jahr 11 monad und [-] tag / [illegible lines]"$nhg$,
        $nhg$Heinrich Brant / geboren den 29 Feb / 1773 / gest. den 14 Feb. 1849 / unalter von 75 jahr 11 monad und [-] tag / [illegible lines]$nhg$,
        ARRAY[1773, 1849]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT (6E, 7, s) upright, white marble, poor cond","descriptor":"upright, white marble, poor cond"}$json$::jsonb
      ),
      (
        'E', 6, 11, 31, 'UNKNOWN', ARRAY['UNKNOWN']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$UNKNOWN (6E, 11, s) upright, white marble, poor cond, fallen "Johann J. / sohn van/ G & Ch [J-] / gest. Juni 19 1857 / alter 3 jahr 7 monad [ - ] tag / Wie wohl ist meinen leib" Note: Last line of epitaph is broken off$nhg$,
        $nhg$Johann J. / sohn van/ G & Ch [J-] / gest. Juni 19 1857 / alter 3 jahr 7 monad [ - ] tag / Wie wohl ist meinen leib$nhg$,
        ARRAY[1857]::integer[],
        ARRAY['Last line of epitaph is broken off.']::text[],
        $json${"heading":"UNKNOWN (6E, 11, s) upright, white marble, poor cond, fallen","descriptor":"upright, white marble, poor cond, fallen"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 231
    AND entry.parsed_section_name = corrections.parsed_section_name
    AND entry.parsed_row_number = corrections.parsed_row_number
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
)
SELECT count(*) FROM updated_entries;

WITH affected_entries AS (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 231
    AND parsed_section_name = 'E'
    AND parsed_row_number = 7
    AND parsed_position_number = 1
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
    ('E', 7, 1, 'CRG', 'Church Records in German', 'death_date', 'October 7, 1879', DATE '1879-10-07', 'CRG: Graf, Sarah Margareta, b. 9 July 1876 in McCandless Township, Allegheny Co. PA, f. October 8, 1879, d. October 7 at 8:30 in the morning, 3 y+', 'high'),
    ('E', 7, 1, 'CRG', 'Church Records in German', 'note', 'Graf, Sarah Margareta, b. 9 July 1876 in McCandless Township, Allegheny Co. PA, f. October 8, 1879, d. October 7 at 8:30 in the morning, 3 y+', NULL::date, 'CRG: Graf, Sarah Margareta, b. 9 July 1876 in McCandless Township, Allegheny Co. PA, f. October 8, 1879, d. October 7 at 8:30 in the morning, 3 y+', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 231
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 231 AND parsed_section_name = 'E' AND parsed_row_number = 7 AND parsed_position_number = 1) AND source_code = 'CRG';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 231 AND parsed_section_name = 'E' AND ((parsed_row_number = 6 AND parsed_position_number IN (4, 5, 12, 13)) OR (parsed_row_number = 7 AND parsed_position_number = 1));
