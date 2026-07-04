--liquibase formatted sql

--changeset cemeterymapping:211-repair-north-hills-page-229 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 229
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        9, 12, '[SCHNABEL]', ARRAY['SCHNABEL']::text[], 'E', 4, 1, 'single', 'upright', 'marble', 'poor',
        $nhg$[SCHNABEL] (4E, 1, s) upright, white marble, poor cond, piece  missing on left side "Georg Schnabel (?) / gest. 14 July [-] / [balance is Illegible]"$nhg$,
        $nhg$Georg Schnabel (?) / gest. 14 July [-] / [balance is Illegible]$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"[SCHNABEL] (4E, 1, s) upright, white marble, poor cond, piece missing on left side","descriptor":"upright, white marble, poor cond, piece missing on left side"}$json$::jsonb
      ),
      (
        13, 16, 'UNKNOWN', ARRAY['UNKNOWN']::text[], 'E', 4, 2, 'single', 'upright', 'marble', 'poor',
        $nhg$UNKNOWN (4E, 2, s} upright, white marble, poor cond, base repaired  with cement, weeping willow "Hier ruht / [-] 1884 / in [-] / [-] / [-]"$nhg$,
        $nhg$Hier ruht / [-] 1884 / in [-] / [-] / [-]$nhg$,
        ARRAY[1884]::integer[],
        ARRAY[]::text[],
        $json${"heading":"UNKNOWN (4E, 2, s) upright, white marble, poor cond, base repaired with cement, weeping willow","descriptor":"upright, white marble, poor cond, base repaired with cement, weeping willow"}$json$::jsonb
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
    229,
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
      AND existing.source_page_number = 229
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
        'E', 3, 5, 7, 'WILL', ARRAY['WILL']::text[], 'single', 'upright', 'marble', 'good',
        $nhg$WILL (3E, 5, s) upright, white marble, good cond, open book on top of lectern "John Will / born Nov. 12, 1806 / died Apr. 20, 1891 / aged 84 y, 5 m. 8 d / Blessed are the dead that die in / the Lord" CRG: Johann Will, b. 12 November 1806 in Rhein-Bavaria, d. 20 April 1891 in Allegheny PA, age 84y 5m, 8da, f. April 22$nhg$,
        $nhg$John Will / born Nov. 12, 1806 / died Apr. 20, 1891 / aged 84 y, 5 m. 8 d / Blessed are the dead that die in / the Lord$nhg$,
        ARRAY[1806, 1891]::integer[],
        ARRAY[]::text[],
        $json${"heading":"WILL (3E, 5, s) upright, white marble, good cond, open book on top of lectern","descriptor":"upright, white marble, good cond, open book on top of lectern"}$json$::jsonb
      ),
      (
        'E', 4, 3, 22, 'UNKNOWN', ARRAY['UNKNOWN']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$UNKNOWN (4E, 3, s) upright, white marble, poor cond, weeping willow"[-][-] in 1883"$nhg$,
        $nhg$[-][-] in 1883$nhg$,
        ARRAY[1883]::integer[],
        ARRAY[]::text[],
        $json${"heading":"UNKNOWN (4E, 3, s) upright, white marble, poor cond, weeping willow","descriptor":"upright, white marble, poor cond, weeping willow"}$json$::jsonb
      ),
      (
        'E', 4, 4, 32, 'WILL', ARRAY['WILL']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$WILL (4E, 4, s) upright, white marble, poor cond, fallen, weeping willow "Johanna Will/ geboren / d. [-] Marz 1811 / gestorben / 12 [Maii] 1878 / [illegible lines]" Stone is same size, shape, and design as (4E, 3)$nhg$,
        $nhg$Johanna Will/ geboren / d. [-] Marz 1811 / gestorben / 12 [Maii] 1878 / [illegible lines]$nhg$,
        ARRAY[1811, 1878]::integer[],
        ARRAY['Stone is same size, shape, and design as (4E, 3).']::text[],
        $json${"heading":"WILL (4E, 4, s) upright, white marble, poor cond, fallen, weeping willow","descriptor":"upright, white marble, poor cond, fallen, weeping willow"}$json$::jsonb
      ),
      (
        'E', 5, 1, 36, 'KILLIAN/KILIAN', ARRAY['KILLIAN','KILIAN']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$KILLIAN/KILIAN (5E, 1, s) upright, white marble, poor cond, fallen, hand with upraised index finger "Henry Killian / died / Dec. 21 1877 / aged / 71 years" CRG: Heinrich Kilian, b. 1805 in Kingdom of Bavaria, d. 21. December 1877, 72y, f. December 23$nhg$,
        $nhg$Henry Killian / died / Dec. 21 1877 / aged / 71 years$nhg$,
        ARRAY[1805, 1877]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KILLIAN/KILIAN (5E, 1, s) upright, white marble, poor cond, fallen, hand with upraised index finger","descriptor":"upright, white marble, poor cond, fallen, hand with upraised index finger"}$json$::jsonb
      ),
      (
        'E', 5, 2, 41, 'KILLIAN', ARRAY['KILLIAN']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$KILLIAN (5E, 2, s) upright, white marble, poor cond, broken, fallen, hand with upraised index finger "Mary Killian/ born / Sept. 10, 1811 / died / Oct. 10(?), 1882 or 88 (broken section)" Stone is same size, shape, and design as (5E, 1)$nhg$,
        $nhg$Mary Killian/ born / Sept. 10, 1811 / died / Oct. 10(?), 1882 or 88 (broken section)$nhg$,
        ARRAY[1811, 1882]::integer[],
        ARRAY['Stone is same size, shape, and design as (5E, 1).']::text[],
        $json${"heading":"KILLIAN (5E, 2, s) upright, white marble, poor cond, broken, fallen, hand with upraised index finger","descriptor":"upright, white marble, poor cond, broken, fallen, hand with upraised index finger"}$json$::jsonb
      ),
      (
        'E', 5, 3, 48, 'KILLIAN', ARRAY['KILLIAN']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$KILLIAN (5E, 3, s) upright, white marble, poor cond, fallen, flag waving with tassels "My son / Daniel Killian / was killed at the battle / of Chancellorsville / April 30, 1863 / 20 years, 2 months, 9 days / Member of Co. E. 136th Regt. / He fell & speak no more/ to [die] / All (-] his soul to Hea[ven] / Aull sharp the stroke / [-]language can convey"$nhg$,
        $nhg$My son / Daniel Killian / was killed at the battle / of Chancellorsville / April 30, 1863 / 20 years, 2 months, 9 days / Member of Co. E. 136th Regt. / He fell & speak no more/ to [die] / All (-] his soul to Hea[ven] / Aull sharp the stroke / [-]language can convey$nhg$,
        ARRAY[1863]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KILLIAN (5E, 3, s) upright, white marble, poor cond, fallen, flag waving with tassels","descriptor":"upright, white marble, poor cond, fallen, flag waving with tassels"}$json$::jsonb
      ),
      (
        'E', 5, 4, 52, 'KILLIAN', ARRAY['KILLIAN']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$KILLIAN (5E, 4, s) upright, white marble, poor cond, reclining lamb "Andrew M. / son of / Henry & Mary / Killian/ died Dec. 22, 1849 / aged 8 months."$nhg$,
        $nhg$Andrew M. / son of / Henry & Mary / Killian/ died Dec. 22, 1849 / aged 8 months.$nhg$,
        ARRAY[1849]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KILLIAN (5E, 4, s) upright, white marble, poor cond, reclining lamb","descriptor":"upright, white marble, poor cond, reclining lamb"}$json$::jsonb
      ),
      (
        'E', 5, 5, 56, 'GRAF', ARRAY['GRAF']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$GRAF (5E, 5, s) upright, white marble, poor cond, fallen, sunken"[-]/ [-] / geb[-] / Graf / 22 Febr. 1860 / [alter von] 65 j / [-] 12 t [-] / [illegible lines]"$nhg$,
        $nhg$[-]/ [-] / geb[-] / Graf / 22 Febr. 1860 / [alter von] 65 j / [-] 12 t [-] / [illegible lines]$nhg$,
        ARRAY[1860]::integer[],
        ARRAY[]::text[],
        $json${"heading":"GRAF (5E, 5, s) upright, white marble, poor cond, fallen, sunken","descriptor":"upright, white marble, poor cond, fallen, sunken"}$json$::jsonb
      )
  ) AS corrections(parsed_section_name, parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 229
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
  WHERE source_page_number = 229
    AND parsed_section_name = 'E'
    AND (
      (parsed_row_number = 3 AND parsed_position_number = 5)
      OR (parsed_row_number = 5 AND parsed_position_number = 1)
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code IN ('CR', 'CRG')
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts AS removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    ('E', 3, 5, 'CRG', 'Church Records in German', 'death_date', 'April 20, 1891', DATE '1891-04-20', 'CRG: Johann Will, b. 12 November 1806 in Rhein-Bavaria, d. 20 April 1891 in Allegheny PA, age 84y 5m, 8da, f. April 22', 'high'),
    ('E', 3, 5, 'CRG', 'Church Records in German', 'note', 'Johann Will, b. 12 November 1806 in Rhein-Bavaria, d. 20 April 1891 in Allegheny PA, age 84y 5m, 8da, f. April 22', NULL::date, 'CRG: Johann Will, b. 12 November 1806 in Rhein-Bavaria, d. 20 April 1891 in Allegheny PA, age 84y 5m, 8da, f. April 22', 'review'),
    ('E', 5, 1, 'CRG', 'Church Records in German', 'death_date', 'December 21, 1877', DATE '1877-12-21', 'CRG: Heinrich Kilian, b. 1805 in Kingdom of Bavaria, d. 21. December 1877, 72y, f. December 23', 'high'),
    ('E', 5, 1, 'CRG', 'Church Records in German', 'note', 'Heinrich Kilian, b. 1805 in Kingdom of Bavaria, d. 21. December 1877, 72y, f. December 23', NULL::date, 'CRG: Heinrich Kilian, b. 1805 in Kingdom of Bavaria, d. 21. December 1877, 72y, f. December 23', 'review')
) AS fact(parsed_section_name, parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_section_name = entry.parsed_section_name
 AND fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 229
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 229 AND parsed_section_name = 'E' AND ((parsed_row_number = 3 AND parsed_position_number = 5) OR (parsed_row_number = 5 AND parsed_position_number = 1))) AND source_code = 'CRG';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 229 AND parsed_section_name = 'E' AND parsed_row_number = 4 AND parsed_position_number IN (1, 2);
