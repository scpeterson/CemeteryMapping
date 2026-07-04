--liquibase formatted sql

--changeset cemeterymapping:202-repair-north-hills-page-222 splitStatements:false
WITH page_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_number = 222
),
entry_values AS (
  SELECT *
  FROM (
    VALUES
      (
        3, 6, 'MILLER', ARRAY['MILLER']::text[], 3, 2, 'single', 'upright', 'marble', 'poor',
        $nhg$MILLER (3D, 2, s) upright, white marble, poor cond, fallen, lamb "Heinrich P. Miller / geboren / 27 April 1880 / gestorben / 25 Jul 1882 / [illegible lines)" Stone same design as 3D, 1. CRG: Heinrich Peter Müller, little son of Peter & Christine, d. 25 July, 1882, b. 27 April 1880, funeral July 27$nhg$,
        $nhg$Heinrich P. Miller / geboren / 27 April 1880 / gestorben / 25 Jul 1882 / [illegible lines)$nhg$,
        ARRAY[1880, 1882]::integer[],
        ARRAY['Stone same design as 3D, 1.']::text[],
        $json${"heading":"MILLER (3D, 2, s) upright, white marble, poor cond, fallen, lamb","descriptor":"upright, white marble, poor cond, fallen, lamb"}$json$::jsonb
      ),
      (
        7, 10, 'MILLER', ARRAY['MILLER']::text[], 3, 3, 'couple', 'upright', 'granite', 'excellent',
        $nhg$MILLER (3D, 3, c) upright, gray granite, exc cond, ornate scroll with "M" "Miller / Peter Miller / 1842-1920 / Christina, his wife/ 1841- 1927"$nhg$,
        $nhg$Miller / Peter Miller / 1842-1920 / Christina, his wife/ 1841- 1927$nhg$,
        ARRAY[1841, 1842, 1920, 1927]::integer[],
        ARRAY[]::text[],
        $json${"heading":"MILLER (3D, 3, c) upright, gray granite, exc cond, ornate scroll with \"M\"","descriptor":"upright, gray granite, exc cond, ornate scroll with \"M\""}$json$::jsonb
      ),
      (
        11, 15, 'BRANDT', ARRAY['BRANDT']::text[], 3, 4, 'single', 'upright', 'metal', 'excellent',
        $nhg$BRANDT (3D, 4, s) upright, gray metal, exc cond, very ornate, open book, on same base as (3D, 5) "Philip Brandt"$nhg$,
        $nhg$Philip Brandt$nhg$,
        ARRAY[]::integer[],
        ARRAY['On same base as (3D, 5).']::text[],
        $json${"heading":"BRANDT (3D, 4, s) upright, gray metal, exc cond, very ornate, open book, on same base as (3D, 5)","descriptor":"upright, gray metal, exc cond, very ornate, open book, on same base as (3D, 5)"}$json$::jsonb
      ),
      (
        28, 38, 'BRANDT', ARRAY['BRANDT']::text[], 3, 6, 'couple', 'upright', 'metal', 'excellent',
        $nhg$BRANDT (3D, 6, c) upright, gray metal, exc cond, bust of man on front, anchor on right side, circle of chain on left side, draped cloth with tassels on four sides, wreath of roses on back, saint holding open book on top. On front: Philip Brandt, / born June 22, 1817, / died Jan. 31, 1907. / Regina Brandt, / born Aug. 29, 1818. / died June 14, 1901. / Our Mother. On base: "BRANDT". On left: "Hier ruhet / Philip, / sohn von / Philip und Regina Brandt, / geboren 1, Nov. 1857, / gestorben / 7, Aug. 1879. / Seine seele gefiel Gott, / Darum elite er mit ihm aus / Diesem bösen leben." On base: "Youth may die." On right: Elizabeth Brandt, / born March 2, 1850, / died October 17, 1927. / Faith points us upward to the sky, / Hope, anchor like, holds till we die." On back: "By faith are ye saved. / 1880" CR: Elizabeth Brandt, d. October 17, 1927 at Portland, Oregon, buried October 24, 1927. CRG: Philipp Brant, grandson of Phil Brant Sr., b. 1 November 1857 in Franklin Township, Allegheny Co., Pa. f. August 8, 1879, d. 7 August at 9:30 in the morning, 22y$nhg$,
        $nhg$Philip Brandt, / born June 22, 1817, / died Jan. 31, 1907. / Regina Brandt, / born Aug. 29, 1818. / died June 14, 1901. / Our Mother. BRANDT Hier ruhet / Philip, / sohn von / Philip und Regina Brandt, / geboren 1, Nov. 1857, / gestorben / 7, Aug. 1879. / Seine seele gefiel Gott, / Darum elite er mit ihm aus / Diesem bösen leben. Youth may die. Elizabeth Brandt, / born March 2, 1850, / died October 17, 1927. / Faith points us upward to the sky, / Hope, anchor like, holds till we die. By faith are ye saved. / 1880$nhg$,
        ARRAY[1817, 1818, 1850, 1857, 1879, 1880, 1901, 1907, 1927]::integer[],
        ARRAY['Gap, about 15 feet.']::text[],
        $json${"heading":"BRANDT (3D, 6, c) upright, gray metal, exc cond, bust of man on front, anchor on right side, circle of chain on left side, draped cloth with tassels on four sides, wreath of roses on back, saint holding open book on top","descriptor":"upright, gray metal, exc cond, bust of man on front, anchor on right side, circle of chain on left side, draped cloth with tassels on four sides, wreath of roses on back, saint holding open book on top"}$json$::jsonb
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
    222,
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
      AND existing.source_page_number = 222
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
        3, 5, 27, 'BRANDT/BRAND', ARRAY['BRANDT','BRAND']::text[], 'single', 'upright', 'metal', 'excellent',
        $nhg$BRANDT/BRAND (3D, 5, s) upright, gray metal, exc cond, broken corner on base, lamb, same base as (3D, 4) "Christena A. / tochter von / P. und R. Brandt. / gest. Den 28 Apr. 1866 / im alter von 11 / Jahren." On base: "Lebet wohl all ihr irdischen freunde." CRG: Christine Emilie, daughter of Von Philip & Regina Brand, f. May 1, 1866, d. 29 April, 11y, 6 hours$nhg$,
        $nhg$Christena A. / tochter von / P. und R. Brandt. / gest. Den 28 Apr. 1866 / im alter von 11 / Jahren. Lebet wohl all ihr irdischen freunde.$nhg$,
        ARRAY[1866]::integer[],
        ARRAY['On same base as (3D, 4).']::text[],
        $json${"heading":"BRANDT/BRAND (3D, 5, s) upright, gray metal, exc cond, broken corner on base, lamb, same base as (3D, 4)","descriptor":"upright, gray metal, exc cond, broken corner on base, lamb, same base as (3D, 4)"}$json$::jsonb
      )
  ) AS corrections(parsed_row_number, parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, parse_notes, source_entry)
  WHERE entry.source_page_number = 222
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
  WHERE source_page_number = 222
    AND parsed_section_name = 'D'
    AND parsed_row_number = 3
    AND parsed_position_number IN (2, 5, 6)
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
    AND observation.observation_text = 'Gap, about 15 feet'
  RETURNING observation.id
)
SELECT (SELECT count(*) FROM removed_facts) AS removed_facts, (SELECT count(*) FROM removed_observations) AS removed_observations;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (2, 'CRG', 'Church Records in German', 'death_date', '25 July 1882', DATE '1882-07-25', 'CRG: Heinrich Peter Müller, little son of Peter & Christine, d. 25 July, 1882, b. 27 April 1880, funeral July 27', 'high'),
    (2, 'CRG', 'Church Records in German', 'note', 'Heinrich Peter Müller, little son of Peter & Christine, d. 25 July, 1882, b. 27 April 1880, funeral July 27', NULL::date, 'CRG: Heinrich Peter Müller, little son of Peter & Christine, d. 25 July, 1882, b. 27 April 1880, funeral July 27', 'review'),
    (5, 'CRG', 'Church Records in German', 'death_date', '29 April 1866', DATE '1866-04-29', 'CRG: Christine Emilie, daughter of Von Philip & Regina Brand, f. May 1, 1866, d. 29 April, 11y, 6 hours', 'high'),
    (5, 'CRG', 'Church Records in German', 'note', 'Christine Emilie, daughter of Von Philip & Regina Brand, f. May 1, 1866, d. 29 April, 11y, 6 hours', NULL::date, 'CRG: Christine Emilie, daughter of Von Philip & Regina Brand, f. May 1, 1866, d. 29 April, 11y, 6 hours', 'review'),
    (6, 'CR', 'Church Records', 'death_date', 'October 17, 1927', DATE '1927-10-17', 'CR: Elizabeth Brandt, d. October 17, 1927 at Portland, Oregon, buried October 24, 1927.', 'high'),
    (6, 'CR', 'Church Records', 'note', 'Elizabeth Brandt, d. October 17, 1927 at Portland, Oregon, buried October 24, 1927.', NULL::date, 'CR: Elizabeth Brandt, d. October 17, 1927 at Portland, Oregon, buried October 24, 1927.', 'review'),
    (6, 'CRG', 'Church Records in German', 'death_date', 'August 7, 1879', DATE '1879-08-07', 'CRG: Philipp Brant, grandson of Phil Brant Sr., b. 1 November 1857 in Franklin Township, Allegheny Co., Pa. f. August 8, 1879, d. 7 August at 9:30 in the morning, 22y', 'high'),
    (6, 'CRG', 'Church Records in German', 'note', 'Philipp Brant, grandson of Phil Brant Sr., b. 1 November 1857 in Franklin Township, Allegheny Co., Pa. f. August 8, 1879, d. 7 August at 9:30 in the morning, 22y', NULL::date, 'CRG: Philipp Brant, grandson of Phil Brant Sr., b. 1 November 1857 in Franklin Township, Allegheny Co., Pa. f. August 8, 1879, d. 7 August at 9:30 in the morning, 22y', 'review')
) AS fact(parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 222
  AND entry.parsed_section_name = 'D'
  AND entry.parsed_row_number = 3
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

INSERT INTO north_hills_ocr_entry_observations (entry_id, observation_type, observation_text, status)
SELECT entry.id, 'gap', 'Gap, about 15 feet', 'staged'
FROM north_hills_ocr_entries entry
WHERE entry.source_page_number = 222
  AND entry.parsed_section_name = 'D'
  AND entry.parsed_row_number = 3
  AND entry.parsed_position_number = 6
ON CONFLICT (entry_id, observation_type, observation_text) DO UPDATE
SET
  status = EXCLUDED.status,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_entry_observations WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 222 AND parsed_section_name = 'D' AND parsed_row_number = 3 AND parsed_position_number = 6) AND observation_type = 'gap' AND observation_text = 'Gap, about 15 feet';
--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 222 AND parsed_section_name = 'D' AND parsed_row_number = 3 AND parsed_position_number IN (2, 5, 6)) AND source_code IN ('CR', 'CRG');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_number = 222 AND parsed_section_name = 'D' AND parsed_row_number = 3 AND parsed_position_number IN (2, 3, 4, 6);
