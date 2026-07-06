--liquibase formatted sql

--changeset cemeterymapping:212-repair-north-hills-page-230 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 230
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        1, 4, '[BA]UMSCHUSSEL', ARRAY['BAUMSCHUSSEL']::text[], 'E', 5, 6, 'single', 'upright', 'marble', 'poor',
        $nhg$[BA]UMSCHUSSEL (5E, 6, s) upright, white marble, poor cond, fallen, weeping willow "Sophia / [Ba]umschussel / geboren / [-] Aug. 1813(?) / gestorben / Den 11 Apr. 1857(?) / [-] der die led[-]mlige / [-] todlen."$nhg$,
        $nhg$Sophia / [Ba]umschussel / geboren / [-] Aug. 1813(?) / gestorben / Den 11 Apr. 1857(?) / [-] der die led[-]mlige / [-] todlen.$nhg$,
        ARRAY[1813, 1857]::integer[],
        ARRAY[]::text[],
        $json${"heading":"[BA]UMSCHUSSEL (5E, 6, s) upright, white marble, poor cond, fallen, weeping willow","descriptor":"upright, white marble, poor cond, fallen, weeping willow"}$json$::jsonb
      ),
      (
        36, 39, 'BRAURMANN', ARRAY['BRAURMANN']::text[], 'E', 6, 1, 'single', 'upright', 'marble', 'poor',
        $nhg$BRAURMANN (6E, 1, s) upright, white marble, poor cond, fallen, hand with upraised Index finger "Johann Heinrich / sohn von / William u. [-] / [-] / geb. d. 2 Mal 1851 / gest. d. 23 Jan. 1875 / alter 23 jahren / 8 mon. 21 [-]" CRG: Braurmann, Heinrich, f, January 25, 1875, d. 23 January, 23y 8m 23da, b May 2, 1851$nhg$,
        $nhg$Johann Heinrich / sohn von / William u. [-] / [-] / geb. d. 2 Mal 1851 / gest. d. 23 Jan. 1875 / alter 23 jahren / 8 mon. 21 [-]$nhg$,
        ARRAY[1851, 1875]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRAURMANN (6E, 1, s) upright, white marble, poor cond, fallen, hand with upraised Index finger","descriptor":"upright, white marble, poor cond, fallen, hand with upraised Index finger"}$json$::jsonb
      ),
      (
        13, 14, 'SPERBER/HOFFMAN/SPERGER', ARRAY['SPERBER','HOFFMAN','SPERGER']::text[], 'E', 5, 8, 'single', 'upright', 'marble', 'poor',
        $nhg$SPERBER/HOFFMAN/SPERGER (5E, 8, s) upright, white marble, poor cond, broken about 8 inches from base, sunken, fallen, weeping willow "Marg. Barbara/ Sperber / [-] / [-] / [1851]", Note: Balance on upright portion of base Is illegible. Stone is same shape and matches (5E, 7). FH: Soergel Margaret Hoffman Sperger, 1817-1854, Johann's wife$nhg$,
        $nhg$Marg. Barbara/ Sperber / [-] / [-] / [1851]$nhg$,
        ARRAY[1817, 1851, 1854]::integer[],
        ARRAY['Balance on upright portion of base is illegible.', 'Stone is same shape and matches (5E, 7).', 'FH: Soergel Margaret Hoffman Sperger, 1817-1854, Johann''s wife.']::text[],
        $json${"heading":"SPERBER/HOFFMAN/SPERGER (5E, 8, s) upright, white marble, poor cond, broken about 8 inches from base, sunken, fallen, weeping willow","descriptor":"upright, white marble, poor cond, broken about 8 inches from base, sunken, fallen, weeping willow"}$json$::jsonb
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
    230,
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
      AND existing.source_page_number = 230
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
        'E', 5, 7, 9, 'SPERBER/SOERGEL/SPERGER', ARRAY['SPERBER','SOERGEL','SPERGER']::text[], 'single', 'upright', 'marble', 'good',
        $nhg$SPERBER/SOERGEL/SPERGER (5E, 7, s) upright, white marble, good cond, broken, fallen, weeping willow "Johann Hein [broken] / Sperber'' Note: rest of stone Is missing. FH:Soergel Johann Heinrich Sperger, 1819-1854. Walburga Soergel's brother$nhg$,
        $nhg$Johann Hein [broken] / Sperber$nhg$,
        ARRAY[1819, 1854]::integer[],
        ARRAY['Rest of stone is missing.', 'FH: Soergel Johann Heinrich Sperger, 1819-1854. Walburga Soergel''s brother.']::text[],
        $json${"heading":"SPERBER/SOERGEL/SPERGER (5E, 7, s) upright, white marble, good cond, broken, fallen, weeping willow","descriptor":"upright, white marble, good cond, broken, fallen, weeping willow"}$json$::jsonb
      ),
      (
        'E', 5, 8, 14, 'SPERBER/HOFFMAN/SPERGER', ARRAY['SPERBER','HOFFMAN','SPERGER']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$SPERBER/HOFFMAN/SPERGER (5E, 8, s) upright, white marble, poor cond, broken about 8 inches from base, sunken, fallen, weeping willow "Marg. Barbara/ Sperber / [-] / [-] / [1851]", Note: Balance on upright portion of base Is illegible. Stone is same shape and matches (5E, 7). FH: Soergel Margaret Hoffman Sperger, 1817-1854, Johann's wife$nhg$,
        $nhg$Marg. Barbara/ Sperber / [-] / [-] / [1851]$nhg$,
        ARRAY[1817, 1851, 1854]::integer[],
        ARRAY['Balance on upright portion of base is illegible.', 'Stone is same shape and matches (5E, 7).', 'FH: Soergel Margaret Hoffman Sperger, 1817-1854, Johann''s wife.']::text[],
        $json${"heading":"SPERBER/HOFFMAN/SPERGER (5E, 8, s) upright, white marble, poor cond, broken about 8 inches from base, sunken, fallen, weeping willow","descriptor":"upright, white marble, poor cond, broken about 8 inches from base, sunken, fallen, weeping willow"}$json$::jsonb
      ),
      (
        'E', 5, 9, 18, 'SPERBER', ARRAY['SPERBER']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$SPERBER (5E, 9, s) upright, white marble, poor cond, lamb "Johann Sperber / Geb d. 18 Mai / 1872 gest d. 7 Oct. / 1876 / Aber der Herr / nimmt mich auf" FH: Soergel 1852-1856, Johann & Margaret's son$nhg$,
        $nhg$Johann Sperber / Geb d. 18 Mai / 1872 gest d. 7 Oct. / 1876 / Aber der Herr / nimmt mich auf$nhg$,
        ARRAY[1852, 1856, 1872, 1876]::integer[],
        ARRAY['FH: Soergel 1852-1856, Johann & Margaret''s son.']::text[],
        $json${"heading":"SPERBER (5E, 9, s) upright, white marble, poor cond, lamb","descriptor":"upright, white marble, poor cond, lamb"}$json$::jsonb
      ),
      (
        'E', 5, 10, 22, 'SOERGEL', ARRAY['SOERGEL']::text[], 'single', 'upright', NULL::varchar, 'poor',
        $nhg$SOERGEL (5E, 10, s) upright, poor cond, fallen, lamb "Heinrich Soergel / Geb. den 19 Juni 18(?) / gest. den 7 Oct. 1861(?) / [Illegible lines]" FH: Soergel 1852-1861, Johann's son$nhg$,
        $nhg$Heinrich Soergel / Geb. den 19 Juni 18(?) / gest. den 7 Oct. 1861(?) / [Illegible lines]$nhg$,
        ARRAY[1852, 1861]::integer[],
        ARRAY['FH: Soergel 1852-1861, Johann''s son.']::text[],
        $json${"heading":"SOERGEL (5E, 10, s) upright, poor cond, fallen, lamb","descriptor":"upright, poor cond, fallen, lamb"}$json$::jsonb
      ),
      (
        'E', 5, 11, 27, 'SOERGEL/SÖRGEL', ARRAY['SOERGEL','SÖRGEL']::text[], 'single', 'upright', 'marble', 'good',
        $nhg$SOERGEL/SÖRGEL (5E, 11, s) upright, white marble, good cond "John H. Soergel / Geboren / den 5ten Mar. 1869 / Gestorben / den 9ten Mar 1869." CRG: Johann Heinrich, little son of Johann Conrad & Walburga Sörgel, f. Mar. 10, 1869, d. 9 Mar. 1869, 4da$nhg$,
        $nhg$John H. Soergel / Geboren / den 5ten Mar. 1869 / Gestorben / den 9ten Mar 1869.$nhg$,
        ARRAY[1869]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SOERGEL/SÖRGEL (5E, 11, s) upright, white marble, good cond","descriptor":"upright, white marble, good cond"}$json$::jsonb
      ),
      (
        'E', 5, 12, 33, 'SPERBER/SOERGEL', ARRAY['SPERBER','SOERGEL']::text[], 'single', 'upright', 'marble', 'good',
        $nhg$SPERBER/SOERGEL (5E, 12, s) upright, white marble, good cond, fallen flat "Unser Vater / Johann G. Sperber / geboren / den 10ten Dec. 1798 / gestorben / den 10ten / Feb. 1877." CRG: Johann Georg Sperber, b. 6 December 1798 In Rublanden Landgericht Lauf, In the Kingdom of Bavaria, f. February 12, 1877, d. 10 February at 1 am, 78y 2m, 4 da. FH: Soergel Walburga Soergel's father$nhg$,
        $nhg$Unser Vater / Johann G. Sperber / geboren / den 10ten Dec. 1798 / gestorben / den 10ten / Feb. 1877.$nhg$,
        ARRAY[1798, 1877]::integer[],
        ARRAY['FH: Soergel Walburga Soergel''s father.']::text[],
        $json${"heading":"SPERBER/SOERGEL (5E, 12, s) upright, white marble, good cond, fallen flat","descriptor":"upright, white marble, good cond, fallen flat"}$json$::jsonb
      ),
      (
        'E', 6, 2, 44, 'ZIEGENTHALER', ARRAY['ZIEGENTHALER']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$ZIEGENTHALER (6E, 2, s) upright, white marble, poor cond, fallen, drape "Hier ruht In.gott / Elizabeth(?) / gatt In von / [-] Ziegenthaler / [-] 17 Mai 188(7?) / alter 71 jahr / 10 mn. 17 [- ]"$nhg$,
        $nhg$Hier ruht In.gott / Elizabeth(?) / gatt In von / [-] Ziegenthaler / [-] 17 Mai 188(7?) / alter 71 jahr / 10 mn. 17 [- ]$nhg$,
        ARRAY[1887]::integer[],
        ARRAY[]::text[],
        $json${"heading":"ZIEGENTHALER (6E, 2, s) upright, white marble, poor cond, fallen, drape","descriptor":"upright, white marble, poor cond, fallen, drape"}$json$::jsonb
      ),
      (
        'E', 6, 3, 46, 'UNKNOWN', ARRAY['UNKNOWN']::text[], 'single', 'upright', 'marble', NULL::varchar,
        $nhg$UNKNOWN (6E, 3, s) upright, marble(?), illegible, fallen$nhg$,
        $nhg$$nhg$,
        ARRAY[]::integer[],
        ARRAY['Illegible inscription.']::text[],
        $json${"heading":"UNKNOWN (6E, 3, s) upright, marble(?), illegible, fallen","descriptor":"upright, marble(?), illegible, fallen"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 230
    AND entry.parsed_section_name = corrections.parsed_section_name
    AND entry.parsed_row_number = corrections.parsed_row_number
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
)
SELECT count(*) FROM updated_entries;

WITH affected_entries AS (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 230
    AND parsed_section_name = 'E'
    AND (
      (parsed_row_number = 5 AND parsed_position_number IN (11, 12))
      OR (parsed_row_number = 6 AND parsed_position_number = 1)
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code IN ('CRG')
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('E', 5, 11, 'CRG', 'Church Records in German', 'death_date', 'March 9, 1869', DATE '1869-03-09', 'CRG: Johann Heinrich, little son of Johann Conrad & Walburga Sörgel, f. Mar. 10, 1869, d. 9 Mar. 1869, 4da', 'high'),
    ('E', 5, 11, 'CRG', 'Church Records in German', 'note', 'Johann Heinrich, little son of Johann Conrad & Walburga Sörgel, f. Mar. 10, 1869, d. 9 Mar. 1869, 4da', NULL::date, 'CRG: Johann Heinrich, little son of Johann Conrad & Walburga Sörgel, f. Mar. 10, 1869, d. 9 Mar. 1869, 4da', 'review'),
    ('E', 5, 12, 'CRG', 'Church Records in German', 'death_date', 'February 10, 1877', DATE '1877-02-10', 'CRG: Johann Georg Sperber, b. 6 December 1798 In Rublanden Landgericht Lauf, In the Kingdom of Bavaria, f. February 12, 1877, d. 10 February at 1 am, 78y 2m, 4 da.', 'high'),
    ('E', 5, 12, 'CRG', 'Church Records in German', 'note', 'Johann Georg Sperber, b. 6 December 1798 In Rublanden Landgericht Lauf, In the Kingdom of Bavaria, f. February 12, 1877, d. 10 February at 1 am, 78y 2m, 4 da.', NULL::date, 'CRG: Johann Georg Sperber, b. 6 December 1798 In Rublanden Landgericht Lauf, In the Kingdom of Bavaria, f. February 12, 1877, d. 10 February at 1 am, 78y 2m, 4 da.', 'review'),
    ('E', 6, 1, 'CRG', 'Church Records in German', 'death_date', 'January 23, 1875', DATE '1875-01-23', 'CRG: Braurmann, Heinrich, f, January 25, 1875, d. 23 January, 23y 8m 23da, b May 2, 1851', 'high'),
    ('E', 6, 1, 'CRG', 'Church Records in German', 'note', 'Braurmann, Heinrich, f, January 25, 1875, d. 23 January, 23y 8m 23da, b May 2, 1851', NULL::date, 'CRG: Braurmann, Heinrich, f, January 25, 1875, d. 23 January, 23y 8m 23da, b May 2, 1851', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 230
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 230 AND parsed_section_name = 'E' AND ((parsed_row_number = 5 AND parsed_position_number IN (11, 12)) OR (parsed_row_number = 6 AND parsed_position_number = 1))) AND source_code = 'CRG';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 230 AND parsed_section_name = 'E' AND ((parsed_row_number = 5 AND parsed_position_number IN (6, 8)) OR (parsed_row_number = 6 AND parsed_position_number = 1));
