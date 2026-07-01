--liquibase formatted sql

--changeset cemeterymapping:165-repair-north-hills-page-196
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WILLS (4B, 4, s) in ground, white marble, poor cond "Willie J. / son of / Jacob & ME Wills / died / Jan 7 1871 / aged 6 years/ [illegible lines]"$nhg$,
  inscription_text = $nhg$Willie J. / son of / Jacob & ME Wills / died / Jan 7 1871 / aged 6 years/ [illegible lines]$nhg$,
  parse_notes = ARRAY['30 feet to end of row']::text[],
  source_entry = jsonb_build_object('heading', 'WILLS (4B, 4, s) in ground, white marble, poor cond', 'descriptor', 'in ground, white marble, poor cond'),
  updated_at = now()
WHERE source_page_index = 17
  AND source_page_number = 196
  AND source_line_start = 3
  AND name_text = 'WILLS';

DELETE FROM north_hills_ocr_source_facts fact
USING north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 17
  AND entry.source_page_number = 196
  AND entry.source_line_start IN (9, 21, 27, 33, 39)
  AND fact.source_code = 'CRG';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 12,
  raw_text = $nhg$PURUCKER (5B, 1, s) upright, white marble, poor cond, sunken, fallen "Emma C. / daughter of / G. Purucker /[ illegible dates]" CRG: Emma Christiane Purucker, daughter of Georg & Margarethe Catharine, f. January 24, 1875, d. 22 January, age 6y 9da$nhg$,
  parsed_row_number = 5,
  inscription_text = $nhg$Emma C. / daughter of / G. Purucker /[ illegible dates]$nhg$,
  parsed_years = ARRAY[1875]::integer[],
  source_entry = jsonb_build_object('heading', 'PURUCKER (5B, 1, s) upright, white marble, poor cond, sunken, fallen', 'descriptor', 'upright, white marble, poor cond, sunken, fallen'),
  updated_at = now()
WHERE source_page_index = 17
  AND source_page_number = 196
  AND source_line_start = 9
  AND name_text = 'PURUCKER';

WITH page_196_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 17
    AND source_page_number = 196
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  196,
  13,
  19,
  $nhg$PURUCKER/PÜRÜCKER/WÖLFEL (5B, 2, s) upright, white marble, poor cond, sunken, fallen "Catharina / gattin von / Geo. Purucker / geboren / 10 Sept. 1826 / gest. / 10. Aug 1892" CRG: Katharina Pürücker nee Wölfel, b. 10 September 1826 In Groseneuren Bavaria, married Loh. on 5 August 1847, d. 10 August 1892, age 65 y 11 m, f. August$nhg$,
  $nhg$PURUCKER/PÜRÜCKER/WÖLFEL$nhg$,
  ARRAY[$nhg$PURUCKER$nhg$, $nhg$PÜRÜCKER$nhg$, $nhg$WÖLFEL$nhg$]::text[],
  'B',
  5,
  2,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Catharina / gattin von / Geo. Purucker / geboren / 10 Sept. 1826 / gest. / 10. Aug 1892$nhg$,
  ARRAY[1826, 1847, 1892]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', $nhg$PURUCKER/PÜRÜCKER/WÖLFEL (5B, 2, s) upright, white marble, poor cond, sunken, fallen$nhg$, 'descriptor', 'upright, white marble, poor cond, sunken, fallen')
FROM page_196_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$PURUCKER/PURNUCKER (5B, 3, s) upright, white marble, poor cond "Georg / Purucker / geboren / 21, Oct. 1820(?) / gest. / 20, Apr. 1898 / [illegible lines]" CRG: Georg Purnucker, b. October 31st 1820 in Golzmühl Oberfranken Bavaria, d. 20 April 1898 in Allegheny, buried April 23 in Franklin T. Pa.$nhg$,
  parsed_row_number = 5,
  parsed_years = ARRAY[1820, 1898]::integer[],
  source_entry = jsonb_build_object('heading', 'PURUCKER/PURNUCKER (5B, 3, s) upright, white marble, poor cond', 'descriptor', 'upright, white marble, poor cond'),
  updated_at = now()
WHERE source_page_index = 17
  AND source_page_number = 196
  AND source_line_start = 21
  AND name_text = 'PURUCKER/PURNUCKER';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WILL (5B, 4, s) upright, white marble, poor cond, hand with upraised index finger, flowers "Hier Ruht / Anna [-] / Tocter von / Jacob u. Charlotte/ Will / geb. d. 29 [-] 1853 / Gest. d. 20 Juli 1871 / [illegible lines]" CRG: Anna Elisabeth Will, daughter of Jacob & Charlotte Will, f. July 22, 1871, d. 20 July, age 18y 1m$nhg$,
  parsed_row_number = 5,
  source_entry = jsonb_build_object('heading', 'WILL (5B, 4, s) upright, white marble, poor cond, hand with upraised index finger, flowers', 'descriptor', 'upright, white marble, poor cond, hand with upraised index finger, flowers'),
  updated_at = now()
WHERE source_page_index = 17
  AND source_page_number = 196
  AND source_line_start = 27
  AND name_text = 'WILL';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WILL/BAUER (5B, 5, s) upright, white marble, poor cond, hand with upraised Index finger, flowers"[-]/ Charlotte(?)/ gattin von / Jacob Will / 10 Mar. 1810 / gestorben / 17 Jun, 18(?) / Alter 70 Jahre / [-], 7 tag/ [illegible lines]" CRG: Charlotte Will nee Bauer in Fischbach, Rhein-Bavaria, f. June 19, 1880, age 70y$nhg$,
  parsed_row_number = 5,
  inscription_text = $nhg$[-]/ Charlotte(?)/ gattin von / Jacob Will / 10 Mar. 1810 / gestorben / 17 Jun, 18(?) / Alter 70 Jahre / [-], 7 tag/ [illegible lines]$nhg$,
  parsed_years = ARRAY[1810, 1880]::integer[],
  source_entry = jsonb_build_object('heading', 'WILL/BAUER (5B, 5, s) upright, white marble, poor cond, hand with upraised Index finger, flowers', 'descriptor', 'upright, white marble, poor cond, hand with upraised Index finger, flowers'),
  updated_at = now()
WHERE source_page_index = 17
  AND source_page_number = 196
  AND source_line_start = 33
  AND name_text = 'WILL/BAUER';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 44,
  raw_text = $nhg$WILL (5B, 6, s) upright, white marble, good cond, hand with upraised index finger, flower "Jacob Will / died / Nov. 16, 1889 / aged / 77 years 1 mo / 5 days 'In labor and love allied / In death they sleep here side by side" CRG: Jacob Will, b. October 10 in Fischbach near Kaiserslautern, Rhein-Bavaria, d. 16 November 1889 in Allegheny, age 77y lm 6da, f. November 18$nhg$,
  parsed_row_number = 5,
  inscription_text = $nhg$Jacob Will / died / Nov. 16, 1889 / aged / 77 years 1 mo / 5 days 'In labor and love allied / In death they sleep here side by side$nhg$,
  source_entry = jsonb_build_object('heading', 'WILL (5B, 6, s) upright, white marble, good cond, hand with upraised index finger, flower', 'descriptor', 'upright, white marble, good cond, hand with upraised index finger, flower'),
  updated_at = now()
WHERE source_page_index = 17
  AND source_page_number = 196
  AND source_line_start = 39
  AND name_text = 'WILL';

WITH page_196_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 17
    AND source_page_number = 196
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text, parsed_years,
  parse_confidence, parse_notes, source_entry
)
SELECT
  batch_id,
  cemetery_id,
  source_page_index,
  196,
  45,
  46,
  $nhg$[WILL] ( 5B, 7, s) upright, white marble, good cond ''A. E. W."$nhg$,
  '[WILL]',
  ARRAY['WILL']::text[],
  'B',
  5,
  7,
  'single',
  'upright',
  'marble',
  'good',
  $nhg$A. E. W.$nhg$,
  ARRAY[]::integer[],
  'medium',
  ARRAY['Sunken area to east toward road']::text[],
  jsonb_build_object('heading', $nhg$[WILL] ( 5B, 7, s) upright, white marble, good cond$nhg$, 'descriptor', 'upright, white marble, good cond')
FROM page_196_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT id, 'CRG', 'Church Records in German', 'note', fact_value, 'CRG: ' || fact_value, 'review'
FROM (
  SELECT
    entry.id,
    CASE entry.source_line_start
      WHEN 9 THEN $nhg$Emma Christiane Purucker, daughter of Georg & Margarethe Catharine, f. January 24, 1875, d. 22 January, age 6y 9da$nhg$
      WHEN 13 THEN $nhg$Katharina Pürücker nee Wölfel, b. 10 September 1826 In Groseneuren Bavaria, married Loh. on 5 August 1847, d. 10 August 1892, age 65 y 11 m, f. August$nhg$
      WHEN 21 THEN $nhg$Georg Purnucker, b. October 31st 1820 in Golzmühl Oberfranken Bavaria, d. 20 April 1898 in Allegheny, buried April 23 in Franklin T. Pa.$nhg$
      WHEN 27 THEN $nhg$Anna Elisabeth Will, daughter of Jacob & Charlotte Will, f. July 22, 1871, d. 20 July, age 18y 1m$nhg$
      WHEN 33 THEN $nhg$Charlotte Will nee Bauer in Fischbach, Rhein-Bavaria, f. June 19, 1880, age 70y$nhg$
      WHEN 39 THEN $nhg$Jacob Will, b. October 10 in Fischbach near Kaiserslautern, Rhein-Bavaria, d. 16 November 1889 in Allegheny, age 77y lm 6da, f. November 18$nhg$
    END AS fact_value
  FROM north_hills_ocr_entries entry
  WHERE entry.source_page_index = 17
    AND entry.source_page_number = 196
    AND entry.source_line_start IN (9, 13, 21, 27, 33, 39)
) facts
WHERE fact_value IS NOT NULL
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 17 AND source_page_number = 196 AND source_line_start IN (9, 13, 21, 27, 33, 39));
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 17 AND source_page_number = 196 AND source_line_start IN (13, 45);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
