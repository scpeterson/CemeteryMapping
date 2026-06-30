--liquibase formatted sql

--changeset cemeterymapping:160-repair-north-hills-page-192
UPDATE north_hills_ocr_entries
SET
  source_line_end = 4,
  raw_text = $nhg$MASHEY (2B, 10, s) flat, bronze, exc cond, leaves "William A. Mashey / Feb. 12, 1891 Nov. 11, 1973"$nhg$,
  inscription_text = $nhg$William A. Mashey / Feb. 12, 1891 Nov. 11, 1973$nhg$,
  parsed_years = ARRAY[1891, 1973]::integer[],
  source_entry = jsonb_build_object('heading', 'MASHEY (2B, 10, s) flat, bronze, exc cond, leaves', 'descriptor', 'flat, bronze, exc cond, leaves'),
  updated_at = now()
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 3
  AND name_text = 'MASHEY';

DELETE FROM north_hills_ocr_source_facts fact
USING north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 13
  AND entry.source_page_number = 192
  AND entry.source_line_start = 3
  AND entry.name_text = 'MASHEY'
  AND fact.source_code = 'CRG';

WITH page_192_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 13
    AND source_page_number = 192
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
  192,
  6,
  8,
  $nhg$STEIGERWALD (2B, 11, s) upright, gray marble, poor cond, sunken, fallen "Andrew / Steigerwald / born / June 16, 1887 / died / June 3, 1896 / At rest" SK: June 16, 1867 - June 8, 1896$nhg$,
  'STEIGERWALD',
  ARRAY['STEIGERWALD']::text[],
  'B',
  2,
  11,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Andrew / Steigerwald / born / June 16, 1887 / died / June 3, 1896 / At rest$nhg$,
  ARRAY[1867, 1887, 1896]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'STEIGERWALD (2B, 11, s) upright, gray marble, poor cond, sunken, fallen', 'descriptor', 'upright, gray marble, poor cond, sunken, fallen')
FROM page_192_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

WITH page_192_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 13
    AND source_page_number = 192
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
  192,
  10,
  14,
  $nhg$STEIGERWALD (2B, 12, s) upright, poor cond, sunken, fallen "Hier ruht in Gott / Johann Steigerwald / geboren in / [ -] / [ -] Baiern / 22 Marz 1819 / gestorben / 19 Marz 1885" CRG: Steigerwald, Johann from Partenstein Bavaria, b. 22 March 18(?), d. 18 March 1885, age 65y llm 27da, f. March 21$nhg$,
  'STEIGERWALD',
  ARRAY['STEIGERWALD']::text[],
  'B',
  2,
  12,
  'single',
  'upright',
  NULL,
  'poor',
  $nhg$Hier ruht in Gott / Johann Steigerwald / geboren in / [ -] / [ -] Baiern / 22 Marz 1819 / gestorben / 19 Marz 1885$nhg$,
  ARRAY[1819, 1885]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'STEIGERWALD (2B, 12, s) upright, poor cond, sunken, fallen', 'descriptor', 'upright, poor cond, sunken, fallen')
FROM page_192_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CRG',
  'Church Records in German',
  'note',
  $nhg$Steigerwald, Johann from Partenstein Bavaria, b. 22 March 18(?), d. 18 March 1885, age 65y llm 27da, f. March 21$nhg$,
  $nhg$CRG: Steigerwald, Johann from Partenstein Bavaria, b. 22 March 18(?), d. 18 March 1885, age 65y llm 27da, f. March 21$nhg$,
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 10
  AND name_text = 'STEIGERWALD'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$BRANDT (2B, 14, s) upright with open ledger, gray granite, exc cond "Sophia Brandt / 1839-1922 / At rest / Mother" CR: Mrs. Philip, d. December 2, 1922, 83y 5m 9da$nhg$,
  inscription_text = $nhg$Sophia Brandt / 1839-1922 / At rest / Mother$nhg$,
  source_entry = jsonb_build_object('heading', 'BRANDT (2B, 14, s) upright with open ledger, gray granite, exc cond', 'descriptor', 'upright with open ledger, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 20
  AND name_text = 'BRANDT';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '83y Sm 9da', '83y 5m 9da'),
  raw_text = replace(fact.raw_text, '83y Sm 9da', '83y 5m 9da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 13
  AND entry.source_page_number = 192
  AND entry.source_line_start = 20
  AND entry.name_text = 'BRANDT'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 28,
  raw_text = $nhg$CUPPS/BRANDT (2B, 15, s) upright, gray granite, exc cond, sunken, fallen, leaves "C / Catherine / wife of / George Cupps, / born May 1, 1864 / died Nov. 25, 1891" CRG: Katharina Cupps nee Brandt, b. 1 May 1864 Allegheny Co., married 2 April 1888, d. 25 November 1891, age 27y 5m 25da, f. November 28$nhg$,
  inscription_text = $nhg$C / Catherine / wife of / George Cupps, / born May 1, 1864 / died Nov. 25, 1891$nhg$,
  parsed_years = ARRAY[1864, 1888, 1891]::integer[],
  source_entry = jsonb_build_object('heading', 'CUPPS/BRANDT (2B, 15, s) upright, gray granite, exc cond, sunken, fallen, leaves', 'descriptor', 'upright, gray granite, exc cond, sunken, fallen, leaves'),
  updated_at = now()
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 24
  AND name_text = 'CUPPS/BRANDT';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = $nhg$Katharina Cupps nee Brandt, b. 1 May 1864 Allegheny Co., married 2 April 1888, d. 25 November 1891, age 27y 5m 25da, f. November 28$nhg$,
  raw_text = $nhg$CRG: Katharina Cupps nee Brandt, b. 1 May 1864 Allegheny Co., married 2 April 1888, d. 25 November 1891, age 27y 5m 25da, f. November 28$nhg$,
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 13
  AND entry.source_page_number = 192
  AND entry.source_line_start = 24
  AND entry.name_text = 'CUPPS/BRANDT'
  AND fact.source_code = 'CRG';

WITH page_192_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 13
    AND source_page_number = 192
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
  192,
  30,
  34,
  $nhg$WALLSCMIEDT/WALDSCHMIDT (2B, 16, s) upright, white marble, poor cond, sunken, fallen, clasped hands "Hier Ruth / Katharina / Wallscmiedt / Geb, 1 Mai 1810 / Gest, 11, Juli/ 1878 / [illegible lines)" CRG: Katharina Waldschmidt, b. 10 May 1810, f. July 13, 1878, d. 11 July at about 8:30 pm, age 67y 2m 11d$nhg$,
  'WALLSCMIEDT/WALDSCHMIDT',
  ARRAY['WALLSCMIEDT', 'WALDSCHMIDT']::text[],
  'B',
  2,
  16,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Hier Ruth / Katharina / Wallscmiedt / Geb, 1 Mai 1810 / Gest, 11, Juli/ 1878 / [illegible lines)$nhg$,
  ARRAY[1810, 1878]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'WALLSCMIEDT/WALDSCHMIDT (2B, 16, s) upright, white marble, poor cond, sunken, fallen, clasped hands', 'descriptor', 'upright, white marble, poor cond, sunken, fallen, clasped hands')
FROM page_192_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CRG',
  'Church Records in German',
  'note',
  $nhg$Katharina Waldschmidt, b. 10 May 1810, f. July 13, 1878, d. 11 July at about 8:30 pm, age 67y 2m 11d$nhg$,
  $nhg$CRG: Katharina Waldschmidt, b. 10 May 1810, f. July 13, 1878, d. 11 July at about 8:30 pm, age 67y 2m 11d$nhg$,
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 30
  AND name_text = 'WALLSCMIEDT/WALDSCHMIDT'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH page_192_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 13
    AND source_page_number = 192
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
  192,
  36,
  37,
  $nhg$GROETZINGER (2B, 17, s) upright, gray granite, exc cond "Christopher/ Groetzinger / 1827-1902 / Father"$nhg$,
  'GROETZINGER',
  ARRAY['GROETZINGER']::text[],
  'B',
  2,
  17,
  'single',
  'upright',
  'granite',
  'excellent',
  $nhg$Christopher/ Groetzinger / 1827-1902 / Father$nhg$,
  ARRAY[1827, 1902]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'GROETZINGER (2B, 17, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond')
FROM page_192_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

WITH page_192_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 13
    AND source_page_number = 192
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
  192,
  38,
  40,
  $nhg$GROETZINGER/GERBIG (2B, 18, s) upright, gray granite, exc cond "Sarah Groetzinger / 1832-1909 / Mother" CR: d. May 12, 1909. Mrs. Sarah Gerbig Groetzinger$nhg$,
  'GROETZINGER/GERBIG',
  ARRAY['GROETZINGER', 'GERBIG']::text[],
  'B',
  2,
  18,
  'single',
  'upright',
  'granite',
  'excellent',
  $nhg$Sarah Groetzinger / 1832-1909 / Mother" CR: d. May 12, 1909. Mrs. Sarah Gerbig Groetzinger$nhg$,
  ARRAY[1832, 1909]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'GROETZINGER/GERBIG (2B, 18, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond')
FROM page_192_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'death_date',
  'May 12, 1909',
  DATE '1909-05-12',
  $nhg$CR: d. May 12, 1909. Mrs. Sarah Gerbig Groetzinger$nhg$,
  'high'
FROM north_hills_ocr_entries
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 38
  AND name_text = 'GROETZINGER/GERBIG'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CR',
  'Church Records',
  'note',
  $nhg$d. May 12, 1909. Mrs. Sarah Gerbig Groetzinger$nhg$,
  $nhg$CR: d. May 12, 1909. Mrs. Sarah Gerbig Groetzinger$nhg$,
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 38
  AND name_text = 'GROETZINGER/GERBIG'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

WITH page_192_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 13
    AND source_page_number = 192
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
  192,
  42,
  46,
  $nhg$GROETZINGER/GERWIG (2B, 19, s) upright, gray granite, exc cond "G / Emil Albert / Groetzinger / born / Jan. 18, 1858: / died / Nov. 14, 1884 / 'For his soul pleased the Lord / Therefore hasted He to take him / Away from amoung the wicked" CRG: Emil Albert Groetzinger, son of Christoph & Sarah nee Gerwig, b. 13 January 1838 in Westmoreland Ct, f. November 16, 1884, d. 14 November, age 26y, 9m, 27d$nhg$,
  'GROETZINGER/GERWIG',
  ARRAY['GROETZINGER', 'GERWIG']::text[],
  'B',
  2,
  19,
  'single',
  'upright',
  'granite',
  'excellent',
  $nhg$G / Emil Albert / Groetzinger / born / Jan. 18, 1858: / died / Nov. 14, 1884 / 'For his soul pleased the Lord / Therefore hasted He to take him / Away from amoung the wicked$nhg$,
  ARRAY[1838, 1858, 1884]::integer[],
  'high',
  ARRAY[]::text[],
  jsonb_build_object('heading', 'GROETZINGER/GERWIG (2B, 19, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond')
FROM page_192_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  id,
  'CRG',
  'Church Records in German',
  'note',
  $nhg$Emil Albert Groetzinger, son of Christoph & Sarah nee Gerwig, b. 13 January 1838 in Westmoreland Ct, f. November 16, 1884, d. 14 November, age 26y, 9m, 27d$nhg$,
  $nhg$CRG: Emil Albert Groetzinger, son of Christoph & Sarah nee Gerwig, b. 13 January 1838 in Westmoreland Ct, f. November 16, 1884, d. 14 November, age 26y, 9m, 27d$nhg$,
  'review'
FROM north_hills_ocr_entries
WHERE source_page_index = 13
  AND source_page_number = 192
  AND source_line_start = 42
  AND name_text = 'GROETZINGER/GERWIG'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_index = 13 AND source_page_number = 192 AND source_line_start IN (6, 10, 30, 36, 38, 42));
--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 13 AND source_page_number = 192 AND source_line_start IN (6, 10, 30, 36, 38, 42);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
