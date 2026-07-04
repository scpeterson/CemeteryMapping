--liquibase formatted sql

--changeset cemeterymapping:204-repair-north-hills-page-224 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 224
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        39, 39, '[KEMPF]', ARRAY['KEMPF']::text[], 5, 6, 'single', 'upright', 'marble', 'poor',
        $nhg$[KEMPF] (5D, 6, s) upright, gray marble, poor cond "Our Mother"$nhg$,
        $nhg$Our Mother$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"[KEMPF] (5D, 6, s) upright, gray marble, poor cond","descriptor":"upright, gray marble, poor cond"}$json$::jsonb
      ),
      (
        46, 46, '[MILLER]', ARRAY['MILLER']::text[], 5, 8, 'single', 'upright', 'marble', 'good',
        $nhg$[MILLER] (5D, 8, s) upright, white marble, good cond "Father"$nhg$,
        $nhg$Father$nhg$,
        ARRAY[]::integer[],
        ARRAY[]::text[],
        $json${"heading":"[MILLER] (5D, 8, s) upright, white marble, good cond","descriptor":"upright, white marble, good cond"}$json$::jsonb
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
    224,
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
      AND existing.source_page_number = 224
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
        5, 2, 16, 'BRANDT /SCHREMPF', ARRAY['BRANDT','SCHREMPF']::text[], 'couple', 'obelisk', 'granite', 'excellent',
        $nhg$BRANDT /SCHREMPF (5D, 2, c) obelisk, gray granite, exc cond, ornate top. On front: "Hier Ruhet in Gott. / Katharine, / Gattin von / J. Heinrich Brandt / geb. Den 3 Juni 1811, / gest. Den 22 Apr. 1886 / alter 74 yahr / 10 monat & 19 tag. / Ich glaube die vergebung / der sünden, die auferstehung / des fleisches und ein / ewiges leben. Amen. / J. Heinrich Brandt / geb. Den 31 Mai 1803, / gest. Den 25 Oct 1890 / alter 87 jahr / 4 monat & 25 tag, / ich bin die auferstehung und / das leben, wer an mich glanbet / der wird leben, ob er gleich / stuerbe. / Brandt CRG: Katharine Brandt nee Schrempf, wife of Johann Heinrich Brandt from Lindheim in Hessen Darmstadt, b. 3 June 1811, f. April 25, 1886(?), d. 22 April, 74y 10m 19d. Johann Heinrich Brandt, b. 31 May 1803 in Lindheim, Hessen Darmstadt, d, 25 October 1890, 87y 7m 25 da, f. October 27. SK: Katharine d. Apr. 22, 1885, 74y 9m 19da$nhg$,
        $nhg$Hier Ruhet in Gott. / Katharine, / Gattin von / J. Heinrich Brandt / geb. Den 3 Juni 1811, / gest. Den 22 Apr. 1886 / alter 74 yahr / 10 monat & 19 tag. / Ich glaube die vergebung / der sünden, die auferstehung / des fleisches und ein / ewiges leben. Amen. / J. Heinrich Brandt / geb. Den 31 Mai 1803, / gest. Den 25 Oct 1890 / alter 87 jahr / 4 monat & 25 tag, / ich bin die auferstehung und / das leben, wer an mich glanbet / der wird leben, ob er gleich / stuerbe. / Brandt$nhg$,
        ARRAY[1803, 1811, 1885, 1886, 1890]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT /SCHREMPF (5D, 2, c) obelisk, gray granite, exc cond, ornate top","descriptor":"obelisk, gray granite, exc cond, ornate top"}$json$::jsonb
      ),
      (
        5, 3, 25, 'BRANDT/ BRANT/KOCH', ARRAY['BRANDT','BRANT','KOCH']::text[], 'single', 'upright', 'marble', NULL::varchar,
        $nhg$BRANDT/ BRANT/KOCH (5D, 3, s) upright, white marble, leaf sprig at tip with "B", ornate top "Annie K. Brandt / died / Dec. 10, 1885 / aged 15 years / 5 mos & 22 days [illegible lines]" CRG: Anna Katherine Brant, b. 18 June 1870, parents are Georg & Anna Margarethe nee Koch (Note: no funeral or death dates given but listed in funeral records between September 21, 1885 and April 25, 1886)$nhg$,
        $nhg$Annie K. Brandt / died / Dec. 10, 1885 / aged 15 years / 5 mos & 22 days [illegible lines]$nhg$,
        ARRAY[1870, 1885, 1886]::integer[],
        ARRAY[]::text[],
        $json${"heading":"BRANDT/ BRANT/KOCH (5D, 3, s) upright, white marble, leaf sprig at tip with \"B\", ornate top","descriptor":"upright, white marble, leaf sprig at tip with \"B\", ornate top"}$json$::jsonb
      ),
      (
        5, 4, 31, 'KEMPF', ARRAY['KEMPF']::text[], 'single', 'upright', 'marble', 'poor',
        $nhg$KEMPF (5D, 4, s) upright, white marble, poor cond "John Kempf / 1808-1881" CRG: Johann Kämpf, b. 27 July 1808 in Bavaria, d. 29 December 1891, age 83 years, 5 months, 2 days, f. December 31$nhg$,
        $nhg$John Kempf / 1808-1881$nhg$,
        ARRAY[1808, 1881, 1891]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KEMPF (5D, 4, s) upright, white marble, poor cond","descriptor":"upright, white marble, poor cond"}$json$::jsonb
      ),
      (
        5, 5, 38, 'KEMPF/KÄMPF/WIRTH', ARRAY['KEMPF','KÄMPF','WIRTH']::text[], 'single', 'obelisk', 'marble', 'poor',
        $nhg$KEMPF/KÄMPF/WIRTH (5D, 5, s) obelisk, gray marble, poor cond, top broken, flowers. On right: "Margaret / wife of / J. Kempf / born / Jan 24, 1808 / died / May 28(?), 1890" CRG: Eva Maria Kämpf nee Wirth, wife of Johann Kämpf, b. 24 January 1808 in Detter Landgericht (District) Brückenau Bavaria, f. 1 June 1890, d. 30 May, 82y 4m 6 da$nhg$,
        $nhg$Margaret / wife of / J. Kempf / born / Jan 24, 1808 / died / May 28(?), 1890$nhg$,
        ARRAY[1808, 1890]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KEMPF/KÄMPF/WIRTH (5D, 5, s) obelisk, gray marble, poor cond, top broken, flowers","descriptor":"obelisk, gray marble, poor cond, top broken, flowers"}$json$::jsonb
      ),
      (
        5, 7, 44, 'KEMPF/KEMF', ARRAY['KEMPF','KEMF']::text[], 'single', 'upright', 'marble', 'good',
        $nhg$KEMPF/KEMF (5D, 7, s) upright, gray marble, good cond "John A. Kempf/ born / Feb. 24, 1848 / died / Mar. 13, 1882." CRG: Johann Adam Kemf, son of John & Margareta, f. March 15, 1882, d. 13 March, b. 24 February 1843. SK Feb. 24, 1843 - Mar. 13, 1862$nhg$,
        $nhg$John A. Kempf/ born / Feb. 24, 1848 / died / Mar. 13, 1882.$nhg$,
        ARRAY[1843, 1848, 1862, 1882]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KEMPF/KEMF (5D, 7, s) upright, gray marble, good cond","descriptor":"upright, gray marble, good cond"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 224
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
  WHERE source_page_number = 224
    AND parsed_section_name = 'D'
    AND parsed_row_number = 5
    AND parsed_position_number IN (2, 3, 4, 5, 7)
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING affected_entries
  WHERE fact.entry_id = affected_entries.id
    AND fact.source_code = 'CRG'
  RETURNING fact.id
),
removed_observations AS (
  DELETE FROM north_hills_ocr_entry_observations observation
  USING affected_entries
  WHERE observation.entry_id = affected_entries.id
    AND observation.observation_type = 'gap'
    AND observation.observation_text IN ('Gap, about 25 feet', 'Gap, about 45 feet with sunken spots')
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (5, 2, 'CRG', 'Church Records in German', 'death_date', 'April 22, 1886', DATE '1886-04-22', 'CRG: Katharine Brandt nee Schrempf, wife of Johann Heinrich Brandt from Lindheim in Hessen Darmstadt, b. 3 June 1811, f. April 25, 1886(?), d. 22 April, 74y 10m 19d. Johann Heinrich Brandt, b. 31 May 1803 in Lindheim, Hessen Darmstadt, d, 25 October 1890, 87y 7m 25 da, f. October 27.', 'high'),
    (5, 2, 'CRG', 'Church Records in German', 'death_date', 'October 25, 1890', DATE '1890-10-25', 'CRG: Katharine Brandt nee Schrempf, wife of Johann Heinrich Brandt from Lindheim in Hessen Darmstadt, b. 3 June 1811, f. April 25, 1886(?), d. 22 April, 74y 10m 19d. Johann Heinrich Brandt, b. 31 May 1803 in Lindheim, Hessen Darmstadt, d, 25 October 1890, 87y 7m 25 da, f. October 27.', 'high'),
    (5, 2, 'CRG', 'Church Records in German', 'note', 'Katharine Brandt nee Schrempf, wife of Johann Heinrich Brandt from Lindheim in Hessen Darmstadt, b. 3 June 1811, f. April 25, 1886(?), d. 22 April, 74y 10m 19d. Johann Heinrich Brandt, b. 31 May 1803 in Lindheim, Hessen Darmstadt, d, 25 October 1890, 87y 7m 25 da, f. October 27.', NULL::date, 'CRG: Katharine Brandt nee Schrempf, wife of Johann Heinrich Brandt from Lindheim in Hessen Darmstadt, b. 3 June 1811, f. April 25, 1886(?), d. 22 April, 74y 10m 19d. Johann Heinrich Brandt, b. 31 May 1803 in Lindheim, Hessen Darmstadt, d, 25 October 1890, 87y 7m 25 da, f. October 27.', 'review'),
    (5, 3, 'CRG', 'Church Records in German', 'note', 'Anna Katherine Brant, b. 18 June 1870, parents are Georg & Anna Margarethe nee Koch (Note: no funeral or death dates given but listed in funeral records between September 21, 1885 and April 25, 1886)', NULL::date, 'CRG: Anna Katherine Brant, b. 18 June 1870, parents are Georg & Anna Margarethe nee Koch (Note: no funeral or death dates given but listed in funeral records between September 21, 1885 and April 25, 1886)', 'review'),
    (5, 4, 'CRG', 'Church Records in German', 'death_date', 'December 29, 1891', DATE '1891-12-29', 'CRG: Johann Kämpf, b. 27 July 1808 in Bavaria, d. 29 December 1891, age 83 years, 5 months, 2 days, f. December 31', 'high'),
    (5, 4, 'CRG', 'Church Records in German', 'note', 'Johann Kämpf, b. 27 July 1808 in Bavaria, d. 29 December 1891, age 83 years, 5 months, 2 days, f. December 31', NULL::date, 'CRG: Johann Kämpf, b. 27 July 1808 in Bavaria, d. 29 December 1891, age 83 years, 5 months, 2 days, f. December 31', 'review'),
    (5, 5, 'CRG', 'Church Records in German', 'death_date', 'May 30, 1890', DATE '1890-05-30', 'CRG: Eva Maria Kämpf nee Wirth, wife of Johann Kämpf, b. 24 January 1808 in Detter Landgericht (District) Brückenau Bavaria, f. 1 June 1890, d. 30 May, 82y 4m 6 da', 'high'),
    (5, 5, 'CRG', 'Church Records in German', 'note', 'Eva Maria Kämpf nee Wirth, wife of Johann Kämpf, b. 24 January 1808 in Detter Landgericht (District) Brückenau Bavaria, f. 1 June 1890, d. 30 May, 82y 4m 6 da', NULL::date, 'CRG: Eva Maria Kämpf nee Wirth, wife of Johann Kämpf, b. 24 January 1808 in Detter Landgericht (District) Brückenau Bavaria, f. 1 June 1890, d. 30 May, 82y 4m 6 da', 'review'),
    (5, 7, 'CRG', 'Church Records in German', 'death_date', 'March 13, 1882', DATE '1882-03-13', 'CRG: Johann Adam Kemf, son of John & Margareta, f. March 15, 1882, d. 13 March, b. 24 February 1843.', 'high'),
    (5, 7, 'CRG', 'Church Records in German', 'note', 'Johann Adam Kemf, son of John & Margareta, f. March 15, 1882, d. 13 March, b. 24 February 1843.', NULL::date, 'CRG: Johann Adam Kemf, son of John & Margareta, f. March 15, 1882, d. 13 March, b. 24 February 1843.', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 224
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
    (5, 2, 'Gap, about 25 feet'),
    (5, 3, 'Gap, about 45 feet with sunken spots')
) AS observation(parsed_row_number, parsed_position_number, observation_text)
  ON observation.parsed_row_number = entry.parsed_row_number
 AND observation.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 224
  AND entry.parsed_section_name = 'D'
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 224 AND parsed_section_name = 'D' AND parsed_row_number = 5 AND parsed_position_number IN (2, 3)) AND observation_type = 'gap' AND observation_text IN ('Gap, about 25 feet', 'Gap, about 45 feet with sunken spots');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 224 AND parsed_section_name = 'D' AND parsed_row_number = 5 AND parsed_position_number IN (2, 3, 4, 5, 7)) AND source_code = 'CRG';
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 224 AND parsed_section_name = 'D' AND parsed_row_number = 5 AND parsed_position_number IN (6, 8);
