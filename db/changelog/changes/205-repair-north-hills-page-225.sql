--liquibase formatted sql

--changeset cemeterymapping:205-repair-north-hills-page-225 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 225
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 11, 'MILLER/KOHLASS', ARRAY['MILLER','KOHLASS']::text[], 5, 9, 'couple', 'obelisk', 'marble', 'good',
        $nhg$MILLER/KOHLASS (5D, 9, c) obelisk, white marble, good cond, ornate top. On front: "John Miller / died / Aug. 27, 1910 / in his / 95th year." On back: "Catharine / wife of / John Miller / died / Jan. 28, 1899 / in her / 82nd year." CRG: Catharine Miller nee Kohlass, b. 1 Nov. 1817 in Holzhausen Hessia Germany, d. 28th of January 1899, buried 30 January, 81y 2m 27da$nhg$,
        $nhg$John Miller / died / Aug. 27, 1910 / in his / 95th year. Catharine / wife of / John Miller / died / Jan. 28, 1899 / in her / 82nd year.$nhg$,
        ARRAY[1817, 1899, 1910]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MILLER/KOHLASS (5D, 9, c) obelisk, white marble, good cond, ornate top","descriptor":"obelisk, white marble, good cond, ornate top"}$json$::jsonb
      ),
      (
        12, 12, '[MILLER]', ARRAY['MILLER']::text[], 5, 10, 'single', 'upright', 'marble', 'good',
        $nhg$[MILLER] (5D, 10, s) upright, white marble, good cond "Mother"$nhg$,
        $nhg$Mother$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"[MILLER] (5D, 10, s) upright, white marble, good cond","descriptor":"upright, white marble, good cond"}$json$::jsonb
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
    225,
    entry_values.source_line_start,
    entry_values.source_line_end,
    entry_values.raw_text,
    entry_values.name_text,
    entry_values.surnames,
    'D',
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
      AND existing.source_page_number = 225
      AND existing.parsed_section_name = 'D'
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
    parsed_section_name = 'D',
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
        5, 9, 11, 'MILLER/KOHLASS', ARRAY['MILLER','KOHLASS']::text[], 'couple', 'obelisk', 'marble', 'good',
        $nhg$MILLER/KOHLASS (5D, 9, c) obelisk, white marble, good cond, ornate top. On front: "John Miller / died / Aug. 27, 1910 / in his / 95th year." On back: "Catharine / wife of / John Miller / died / Jan. 28, 1899 / in her / 82nd year." CRG: Catharine Miller nee Kohlass, b. 1 Nov. 1817 in Holzhausen Hessia Germany, d. 28th of January 1899, buried 30 January, 81y 2m 27da$nhg$,
        $nhg$John Miller / died / Aug. 27, 1910 / in his / 95th year. Catharine / wife of / John Miller / died / Jan. 28, 1899 / in her / 82nd year.$nhg$,
        ARRAY[1817, 1899, 1910]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MILLER/KOHLASS (5D, 9, c) obelisk, white marble, good cond, ornate top","descriptor":"obelisk, white marble, good cond, ornate top"}$json$::jsonb
      ),
      (
        6, 1, 16, 'BRANT', ARRAY['BRANT']::text[], 'single', 'upright, ledger', 'granite', 'excellent',
        $nhg$BRANT (6D, 1, s) upright with open ledger, gray granite, exc cond "Henry Brant / 1839-1900 / At rest" At foot of bed "In God we trust"$nhg$,
        $nhg$Henry Brant / 1839-1900 / At rest In God we trust$nhg$,
        ARRAY[1839, 1900]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT (6D, 1, s) upright with open ledger, gray granite, exc cond","descriptor":"upright with open ledger, gray granite, exc cond"}$json$::jsonb
      ),
      (
        6, 2, 20, 'BRANT', ARRAY['BRANT']::text[], 'single', 'upright, ledger', 'granite', 'excellent',
        $nhg$BRANT (6D, 2, s) upright with open ledger, gray granite, exc cond "Mary Brant / 1841-1903 / At rest" At foot of bed "Forever with the / Lord"$nhg$,
        $nhg$Mary Brant / 1841-1903 / At rest Forever with the / Lord$nhg$,
        ARRAY[1841, 1903]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT (6D, 2, s) upright with open ledger, gray granite, exc cond","descriptor":"upright with open ledger, gray granite, exc cond"}$json$::jsonb
      ),
      (
        6, 3, 24, 'BRANT', ARRAY['BRANT']::text[], 'single', 'upright, ledger', 'granite', 'excellent',
        $nhg$BRANT (6D, 3, s) upright with open ledger, gray granite, exc cond "Albert F. Brant / 1878-1900 / Died in Alaska" At foot of bed "I know that my / Redeemer liveth"$nhg$,
        $nhg$Albert F. Brant / 1878-1900 / Died in Alaska I know that my / Redeemer liveth$nhg$,
        ARRAY[1878, 1900]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT (6D, 3, s) upright with open ledger, gray granite, exc cond","descriptor":"upright with open ledger, gray granite, exc cond"}$json$::jsonb
      ),
      (
        6, 4, 28, 'BRANT', ARRAY['BRANT']::text[], 'single', 'upright, ledger', 'granite', 'excellent',
        $nhg$BRANT (6D, 4, s) upright with open ledger, gray granite, exc cond "Olive L. Brant / 1881-1900 / Asleep in Jesus" At foot of bed "I shall not die / but live"$nhg$,
        $nhg$Olive L. Brant / 1881-1900 / Asleep in Jesus I shall not die / but live$nhg$,
        ARRAY[1881, 1900]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANT (6D, 4, s) upright with open ledger, gray granite, exc cond","descriptor":"upright with open ledger, gray granite, exc cond"}$json$::jsonb
      ),
      (
        6, 5, 32, 'P[-]', ARRAY[]::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$P[-] (6D, 5, s) upright, gray granite, exc cond "M. P."$nhg$,
        $nhg$M. P.$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"P[-] (6D, 5, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        6, 6, 37, 'HAGUE/LOVE/FRYE', ARRAY['HAGUE','LOVE','FRYE']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$HAGUE/LOVE/FRYE (6D, 6, c) upright, gray granite, exc cond, flowers, leaves "Hague / Frank G. / 1877-1958 / Carrie / 1876-1971" Separate flag holder: "American / US / Legion", star CR: Frank, d. October 4, 1958, 81y 2m 7da. Mrs. Love's and Mrs. Frye's father$nhg$,
        $nhg$Hague / Frank G. / 1877-1958 / Carrie / 1876-1971 American / US / Legion$nhg$,
        ARRAY[1876, 1877, 1958, 1971]::integer[],
        ARRAY[]::text[],
        $json${"heading":"HAGUE/LOVE/FRYE (6D, 6, c) upright, gray granite, exc cond, flowers, leaves","descriptor":"upright, gray granite, exc cond, flowers, leaves"}$json$::jsonb
      ),
      (
        6, 7, 44, 'BRANDT/BRAND', ARRAY['BRANDT','BRAND']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$BRANDT/BRAND (6D, 7, s) upright, white marble, poor cond, fallen, drapery across top, inscription on shield / "Hier ruhet in Gott / Georg Brandt / geboren / 27 Dec. 1812, / gestorben 9 Dec. 1883, / alte[r] 70 jahre / 11 mo 12 ta / [illegible lines]" CRG: Georg Brand, b. in Lindheim, Hessen Darmstadt on 2 December 1812, f. December 11, 1883, d. 9 December, age 71y 7da$nhg$,
        $nhg$Hier ruhet in Gott / Georg Brandt / geboren / 27 Dec. 1812, / gestorben 9 Dec. 1883, / alte[r] 70 jahre / 11 mo 12 ta / [illegible lines]$nhg$,
        ARRAY[1812, 1883]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT/BRAND (6D, 7, s) upright, white marble, poor cond, fallen, drapery across top, inscription on shield","descriptor":"upright, white marble, poor cond, fallen, drapery across top, inscription on shield"}$json$::jsonb
      ),
      (
        6, 8, 50, 'BRANDT', ARRAY['BRANDT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BRANDT (6D, 8, s) upright, gray granite, exc cond "B / Kathi:erine / Brandt/ Jan. 20. 1835 / Feb. 1. 1919 / Our beloved / Mother" CR: Catharine$nhg$,
        $nhg$B / Kathi:erine / Brandt/ Jan. 20. 1835 / Feb. 1. 1919 / Our beloved / Mother$nhg$,
        ARRAY[1835, 1919]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT (6D, 8, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        6, 9, 53, 'BRANDT', ARRAY['BRANDT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BRANDT (6D, 9, s) upright, gray granite, exc cond "B / Elizabeth / Brandt / born / Nov. 13, 1857 / died / Mar. 8, 1903 / Asleep in Jesus"$nhg$,
        $nhg$B / Elizabeth / Brandt / born / Nov. 13, 1857 / died / Mar. 8, 1903 / Asleep in Jesus$nhg$,
        ARRAY[1857, 1903]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT (6D, 9, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 225
    AND entry.parsed_section_name = 'D'
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
  WHERE source_page_number = 225
    AND parsed_section_name = 'D'
    AND (
      (parsed_row_number = 5 AND parsed_position_number = 9)
      OR (parsed_row_number = 6 AND parsed_position_number IN (4, 6, 7, 8))
    )
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code IN ('CR', 'CRG')
  RETURNING fact.id
),
removed_observations AS (
  DELETE FROM north_hills_ocr_entry_observations observation
  USING affected_entries
  WHERE observation.entry_id = affected_entries.id
    AND observation.observation_type = 'gap'
    AND observation.observation_text IN ('Gap, about 25 feet, with depressions', 'Gap, about 15 feet.')
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (5, 9, 'CRG', 'Church Records in German', 'death_date', 'January 28, 1899', DATE '1899-01-28', 'CRG: Catharine Miller nee Kohlass, b. 1 Nov. 1817 in Holzhausen Hessia Germany, d. 28th of January 1899, buried 30 January, 81y 2m 27da', 'high'),
    (5, 9, 'CRG', 'Church Records in German', 'note', 'Catharine Miller nee Kohlass, b. 1 Nov. 1817 in Holzhausen Hessia Germany, d. 28th of January 1899, buried 30 January, 81y 2m 27da', NULL::date, 'CRG: Catharine Miller nee Kohlass, b. 1 Nov. 1817 in Holzhausen Hessia Germany, d. 28th of January 1899, buried 30 January, 81y 2m 27da', 'review'),
    (6, 6, 'CR', 'Church Records', 'death_date', 'October 4, 1958', DATE '1958-10-04', 'CR: Frank, d. October 4, 1958, 81y 2m 7da. Mrs. Love''s and Mrs. Frye''s father', 'high'),
    (6, 6, 'CR', 'Church Records', 'note', 'Frank, d. October 4, 1958, 81y 2m 7da. Mrs. Love''s and Mrs. Frye''s father', NULL::date, 'CR: Frank, d. October 4, 1958, 81y 2m 7da. Mrs. Love''s and Mrs. Frye''s father', 'review'),
    (6, 7, 'CRG', 'Church Records in German', 'death_date', 'December 9, 1883', DATE '1883-12-09', 'CRG: Georg Brand, b. in Lindheim, Hessen Darmstadt on 2 December 1812, f. December 11, 1883, d. 9 December, age 71y 7da', 'high'),
    (6, 7, 'CRG', 'Church Records in German', 'note', 'Georg Brand, b. in Lindheim, Hessen Darmstadt on 2 December 1812, f. December 11, 1883, d. 9 December, age 71y 7da', NULL::date, 'CRG: Georg Brand, b. in Lindheim, Hessen Darmstadt on 2 December 1812, f. December 11, 1883, d. 9 December, age 71y 7da', 'review'),
    (6, 8, 'CR', 'Church Records', 'note', 'Catharine', NULL::date, 'CR: Catharine', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 225
  AND entry.parsed_section_name = 'D'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

INSERT INTO north_hills_ocr_entry_observations (entry_id, observation_type, observation_text, status)
SELECT entry.id, 'gap', observation.observation_text, 'staged'
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (6, 4, 'Gap, about 25 feet, with depressions'),
    (6, 7, 'Gap, about 15 feet.')
) AS observation(parsed_row_number, parsed_position_number, observation_text)
  ON observation.parsed_row_number = entry.parsed_row_number
 AND observation.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 225
  AND entry.parsed_section_name = 'D'
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 225 AND parsed_section_name = 'D' AND parsed_row_number = 6 AND parsed_position_number IN (4, 7)) AND observation_type = 'gap' AND observation_text IN ('Gap, about 25 feet, with depressions', 'Gap, about 15 feet.');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 225 AND parsed_section_name = 'D' AND ((parsed_row_number = 5 AND parsed_position_number = 9) OR (parsed_row_number = 6 AND parsed_position_number IN (6, 7, 8)))) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 225 AND parsed_section_name = 'D' AND parsed_row_number = 5 AND parsed_position_number IN (9, 10);
