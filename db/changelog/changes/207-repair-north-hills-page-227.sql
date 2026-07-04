--liquibase formatted sql

--changeset cemeterymapping:207-repair-north-hills-page-227 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 227
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        17, 20, 'KIND/KING', ARRAY['KIND','KING']::text[], 9, 1, 'single', 'upright, scroll', 'granite', 'excellent',
        $nhg$KIND/KING (9D, 1, s) upright, scroll, gray granite, exc cond "Margaret Kind / 1838-1920 / At rest / Mother" CR: Mrs. Margaret King Kind, d. May 9, 1920$nhg$,
        $nhg$Margaret Kind / 1838-1920 / At rest / Mother$nhg$,
        ARRAY[1838, 1920]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KIND/KING (9D, 1, s) upright, scroll, gray granite, exc cond","descriptor":"upright, scroll, gray granite, exc cond"}$json$::jsonb
      ),
      (
        21, 24, 'KIND', ARRAY['KIND']::text[], 9, 2, 'single', 'upright, scroll', 'granite', 'excellent',
        $nhg$KIND (9D, 2, s) upright, scroll, gray granite., exc cond ''Adam J. Kind / 1831-1909 / At rest / Father" CR: d. October 14, 1909$nhg$,
        $nhg$Adam J. Kind / 1831-1909 / At rest / Father$nhg$,
        ARRAY[1831, 1909]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KIND (9D, 2, s) upright, scroll, gray granite, exc cond","descriptor":"upright, scroll, gray granite, exc cond"}$json$::jsonb
      ),
      (
        46, 48, 'SCHMELTZ/SCHMELZ/SCHARF', ARRAY['SCHMELTZ','SCHMELZ','SCHARF']::text[], 10, 2, 'single', 'upright', 'marble', 'poor',
        $nhg$SCHMELTZ/SCHMELZ/SCHARF (10D, 2, s) upright, gray marble, poor cond, sunken, fallen, lamb "Adam Georg / sohn van GH & [-] / Schmeltz / geboren / 6 Nov. 1878 / gestorben / 2 Sep 1887" CRG: Adam Geo. Schmelz, son of Georg & Sussan wife nee Scharf, f. September 4, 1887$nhg$,
        $nhg$Adam Georg / sohn van GH & [-] / Schmeltz / geboren / 6 Nov. 1878 / gestorben / 2 Sep 1887$nhg$,
        ARRAY[1878, 1887]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHMELTZ/SCHMELZ/SCHARF (10D, 2, s) upright, gray marble, poor cond, sunken, fallen, lamb","descriptor":"upright, gray marble, poor cond, sunken, fallen, lamb"}$json$::jsonb
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
    227,
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
      AND existing.source_page_number = 227
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
        8, 7, 5, 'SCHARF/BERGMAN', ARRAY['SCHARF','BERGMAN']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$SCHARF/BERGMAN (8D, 7, s) upright, gray granite, exc cond "Anna M. Scharf / 1862-1939 / Mother" CR: Anne M. Bergman Scharf, d. April 21, 1939. CRG: See note with (8D, 4)$nhg$,
        $nhg$Anna M. Scharf / 1862-1939 / Mother$nhg$,
        ARRAY[1862, 1939]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHARF/BERGMAN (8D, 7, s) upright, gray granite, exc cond","descriptor":"upright, gray granite, exc cond"}$json$::jsonb
      ),
      (
        8, 9, 16, 'SARVER/BEUERMANN', ARRAY['SARVER','BEUERMANN']::text[], 'single', 'obelisk', 'marble', 'poor',
        $nhg$SARVER/BEUERMANN (8D, 9, s) small obelisk, gray marble, poor cond "Albert C. / son of / L. Sarver/ died / April 23 / 1889 / aged / 10 mo's / 2 days/ [illegible lines]" CRG: Albert Clarence Sarver, little son of Jacob & Lizzie nee Beuermann, f. May 1, 1889, d. 29 April, 10m 2da$nhg$,
        $nhg$Albert C. / son of / L. Sarver/ died / April 23 / 1889 / aged / 10 mo's / 2 days/ [illegible lines]$nhg$,
        ARRAY[1889]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SARVER/BEUERMANN (8D, 9, s) small obelisk, gray marble, poor cond","descriptor":"small obelisk, gray marble, poor cond"}$json$::jsonb
      ),
      (
        9, 3, 29, 'KIND/KÖNIG', ARRAY['KIND','KÖNIG']::text[], 'single', 'flat', 'marble', 'poor',
        $nhg$KIND/KÖNIG (9D, 3, s) flat, white marble, poor cond, sunken, wild rose, shield"[-] in Gott / Louise Kind / geboren den / 8 Sept 1878 / gestoren den / 6 Sept 1886" CRG: Louise Kind, daughter of Adam & Margaretha nee König, f. September 1886$nhg$,
        $nhg$[-] in Gott / Louise Kind / geboren den / 8 Sept 1878 / gestoren den / 6 Sept 1886$nhg$,
        ARRAY[1878, 1886]::integer[],
        ARRAY[]::text[],
        $json${"heading":"KIND/KÖNIG (9D, 3, s) flat, white marble, poor cond, sunken, wild rose, shield","descriptor":"flat, white marble, poor cond, sunken, wild rose, shield"}$json$::jsonb
      ),
      (
        10, 1, 45, 'SCHMELTZ', ARRAY['SCHMELTZ']::text[], 'couple', 'obelisk', 'marble', 'poor',
        $nhg$SCHMELTZ (10D, 1, c) obelisk, white marble, poor cond. "On front: "Schmeltz" On right: "Elizabeth / Schmeltz / Apr. 27. 1837 / Sept. 12. 1913 / Mother. On left: Heir ruhet in Gott / Georg H. Schmeltz / gestorben / 19 Juni 1901 / alter 68 jahr 6 mo 13 ta / [illegible lines]"$nhg$,
        $nhg$Schmeltz Elizabeth / Schmeltz / Apr. 27. 1837 / Sept. 12. 1913 / Mother. Heir ruhet in Gott / Georg H. Schmeltz / gestorben / 19 Juni 1901 / alter 68 jahr 6 mo 13 ta / [illegible lines]$nhg$,
        ARRAY[1837, 1901, 1913]::integer[],
        ARRAY[]::text[],
        $json${"heading":"SCHMELTZ (10D, 1, c) obelisk, white marble, poor cond","descriptor":"obelisk, white marble, poor cond"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 227
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
  WHERE source_page_number = 227
    AND parsed_section_name = 'D'
    AND (
      (parsed_row_number = 8 AND parsed_position_number IN (7, 9))
      OR (parsed_row_number = 9 AND parsed_position_number IN (1, 2, 3))
      OR (parsed_row_number = 10 AND parsed_position_number IN (1, 2))
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
    AND (
      (observation.observation_type = 'gap' AND observation.observation_text IN ('Gap of 15 feet with depression.', 'Gap, about 24 feet'))
      OR (observation.observation_type = 'plot_marker' AND observation.observation_text IN ('Plot marker, white "P. B." before 7D, 1', 'Plot marker, white "P. B." after gap before 7D, 1'))
    )
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (8, 7, 'CR', 'Church Records', 'death_date', 'April 21, 1939', DATE '1939-04-21', 'CR: Anne M. Bergman Scharf, d. April 21, 1939.', 'high'),
    (8, 7, 'CR', 'Church Records', 'note', 'Anne M. Bergman Scharf, d. April 21, 1939.', NULL::date, 'CR: Anne M. Bergman Scharf, d. April 21, 1939.', 'review'),
    (8, 7, 'CRG', 'Church Records in German', 'note', 'See note with (8D, 4)', NULL::date, 'CRG: See note with (8D, 4)', 'review'),
    (8, 9, 'CRG', 'Church Records in German', 'death_date', 'April 29, 1889', DATE '1889-04-29', 'CRG: Albert Clarence Sarver, little son of Jacob & Lizzie nee Beuermann, f. May 1, 1889, d. 29 April, 10m 2da', 'high'),
    (8, 9, 'CRG', 'Church Records in German', 'note', 'Albert Clarence Sarver, little son of Jacob & Lizzie nee Beuermann, f. May 1, 1889, d. 29 April, 10m 2da', NULL::date, 'CRG: Albert Clarence Sarver, little son of Jacob & Lizzie nee Beuermann, f. May 1, 1889, d. 29 April, 10m 2da', 'review'),
    (9, 1, 'CR', 'Church Records', 'death_date', 'May 9, 1920', DATE '1920-05-09', 'CR: Mrs. Margaret King Kind, d. May 9, 1920', 'high'),
    (9, 1, 'CR', 'Church Records', 'note', 'Mrs. Margaret King Kind, d. May 9, 1920', NULL::date, 'CR: Mrs. Margaret King Kind, d. May 9, 1920', 'review'),
    (9, 2, 'CR', 'Church Records', 'death_date', 'October 14, 1909', DATE '1909-10-14', 'CR: d. October 14, 1909', 'high'),
    (9, 2, 'CR', 'Church Records', 'note', 'd. October 14, 1909', NULL::date, 'CR: d. October 14, 1909', 'review'),
    (9, 3, 'CRG', 'Church Records in German', 'note', 'Louise Kind, daughter of Adam & Margaretha nee König, f. September 1886', NULL::date, 'CRG: Louise Kind, daughter of Adam & Margaretha nee König, f. September 1886', 'review'),
    (10, 2, 'CRG', 'Church Records in German', 'note', 'Adam Geo. Schmelz, son of Georg & Sussan wife nee Scharf, f. September 4, 1887', NULL::date, 'CRG: Adam Geo. Schmelz, son of Georg & Sussan wife nee Scharf, f. September 4, 1887', 'review')
) AS fact(parsed_row_number, parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_row_number = entry.parsed_row_number
 AND fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 227
  AND entry.parsed_section_name = 'D'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

INSERT INTO north_hills_ocr_entry_observations (entry_id, observation_type, observation_text, status)
SELECT entry.id, observation.observation_type, observation.observation_text, 'staged'
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (7, 1, 'plot_marker', 'Plot marker, white "P. B." before 7D, 1'),
    (7, 1, 'gap', 'Gap of 15 feet with depression.'),
    (7, 1, 'plot_marker', 'Plot marker, white "P. B." after gap before 7D, 1'),
    (9, 3, 'gap', 'Gap, about 24 feet')
) AS observation(parsed_row_number, parsed_position_number, observation_type, observation_text)
  ON observation.parsed_row_number = entry.parsed_row_number
 AND observation.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 227
  AND entry.parsed_section_name = 'D'
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 227 AND parsed_section_name = 'D' AND ((parsed_row_number = 7 AND parsed_position_number = 1) OR (parsed_row_number = 9 AND parsed_position_number = 3))) AND observation_text IN ('Plot marker, white "P. B." before 7D, 1', 'Gap of 15 feet with depression.', 'Plot marker, white "P. B." after gap before 7D, 1', 'Gap, about 24 feet');
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 227 AND parsed_section_name = 'D' AND ((parsed_row_number = 8 AND parsed_position_number IN (7, 9)) OR (parsed_row_number = 9 AND parsed_position_number IN (1, 2, 3)) OR (parsed_row_number = 10 AND parsed_position_number = 2))) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 227 AND parsed_section_name = 'D' AND ((parsed_row_number = 9 AND parsed_position_number IN (1, 2)) OR (parsed_row_number = 10 AND parsed_position_number = 2));
