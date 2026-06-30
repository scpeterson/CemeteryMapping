--liquibase formatted sql

--changeset cemeterymapping:162-repair-north-hills-page-194
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SCHNABEL/SCHNOBEL (3B, 11, s) upright, gray granite, exc cond, scroll, leaves "PS /  Philip Schnabel / born Sept. 7, 1821, / died Dec. 17, 1921. / age 100 years / Selig sind die todten, / die in dem herrn sterben / Rev. 14-18." CR: Philip Schnobel, Sr., d. December 19, 1921, l00y 3m 11da$nhg$,
  inscription_text = $nhg$PS /  Philip Schnabel / born Sept. 7, 1821, / died Dec. 17, 1921. / age 100 years / Selig sind die todten, / die in dem herrn sterben / Rev. 14-18.$nhg$,
  source_entry = jsonb_build_object('heading', 'SCHNABEL/SCHNOBEL (3B, 11, s) upright, gray granite, exc cond, scroll, leaves', 'descriptor', 'upright, gray granite, exc cond, scroll, leaves'),
  updated_at = now()
WHERE source_page_index = 15
  AND source_page_number = 194
  AND source_line_start = 3
  AND name_text = 'SCHNABEL/SCHNOBEL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, 'l00y 3m llda', 'l00y 3m 11da'),
  raw_text = replace(fact.raw_text, 'l00y 3m llda', 'l00y 3m 11da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 15
  AND entry.source_page_number = 194
  AND entry.source_line_start = 3
  AND entry.name_text = 'SCHNABEL/SCHNOBEL'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SCHNABEL (3B, 13, s) upright, gray granite, exc cond, scroll, leaves "SL / Hlerruhet in Gott / Louise Schnabel / geboren / 1, Juli 1860, / gestorben / 14, Juli 1887. / Ich habe eihen guten kampf gekampft, / Ich habe den lauf vollendet ich habe / Glauben gehalten hinfort ist mir / beigelegt die krone der gerechtickeit" CRG: Louise Schnabel, f. July 17, 1887, d. 14 July, age 27y 14 d$nhg$,
  inscription_text = $nhg$SL / Hlerruhet in Gott / Louise Schnabel / geboren / 1, Juli 1860, / gestorben / 14, Juli 1887. / Ich habe eihen guten kampf gekampft, / Ich habe den lauf vollendet ich habe / Glauben gehalten hinfort ist mir / beigelegt die krone der gerechtickeit$nhg$,
  source_entry = jsonb_build_object('heading', 'SCHNABEL (3B, 13, s) upright, gray granite, exc cond, scroll, leaves', 'descriptor', 'upright, gray granite, exc cond, scroll, leaves'),
  updated_at = now()
WHERE source_page_index = 15
  AND source_page_number = 194
  AND source_line_start = 17
  AND name_text = 'SCHNABEL';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 33,
  raw_text = $nhg$BEUERMAN (3B, 15, s) upright, white marble, exc cond "Marie Louise / Beuerman / Sept. 1849 / Sept. 1870" CRG: Marie Luise Beuerman, dau. of Adolph Daniel & Charlotte, f. September 15, 1871, d. 13 September, age 22y 4da$nhg$,
  inscription_text = $nhg$Marie Louise / Beuerman / Sept. 1849 / Sept. 1870$nhg$,
  parsed_years = ARRAY[1849, 1870, 1871]::integer[],
  source_entry = jsonb_build_object('heading', 'BEUERMAN (3B, 15, s) upright, white marble, exc cond', 'descriptor', 'upright, white marble, exc cond'),
  updated_at = now()
WHERE source_page_index = 15
  AND source_page_number = 194
  AND source_line_start = 30
  AND name_text = 'BEUERMAN';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = 'Marie Luise Beuerman, dau. of Adolph Daniel & Charlotte, f. September 15, 1871, d. 13 September, age 22y 4da',
  raw_text = 'CRG: Marie Luise Beuerman, dau. of Adolph Daniel & Charlotte, f. September 15, 1871, d. 13 September, age 22y 4da',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 15
  AND entry.source_page_number = 194
  AND entry.source_line_start = 30
  AND entry.name_text = 'BEUERMAN'
  AND fact.source_code = 'CRG';

WITH page_194_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 15
    AND source_page_number = 194
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
  194,
  35,
  35,
  $nhg$[BEUERMAl!f] (3B, 16, s) upright, white marble, poor cond, lamb "Franz"$nhg$,
  '[BEUERMAl!f]',
  ARRAY['BEUERMAN']::text[],
  'B',
  3,
  16,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Franz$nhg$,
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', '[BEUERMAl!f] (3B, 16, s) upright, white marble, poor cond, lamb', 'descriptor', 'upright, white marble, poor cond, lamb')
FROM page_194_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

WITH page_194_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 15
    AND source_page_number = 194
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
  194,
  37,
  41,
  $nhg$[BEUERMANN] (3B, 17, s) upright, white marble, poor cond. On top: "Father" On front: "A light Is from our/ Household gone / A voice we loved is / Stilled / A vacant place / Around our hearth / That never can be/ Filled"$nhg$,
  '[BEUERMANN]',
  ARRAY['BEUERMANN']::text[],
  'B',
  3,
  17,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Father A light Is from our/ Household gone / A voice we loved is / Stilled / A vacant place / Around our hearth / That never can be/ Filled$nhg$,
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', '[BEUERMANN] (3B, 17, s) upright, white marble, poor cond. On top:', 'descriptor', 'upright, white marble, poor cond. On top:')
FROM page_194_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

UPDATE north_hills_ocr_entries
SET
  source_line_end = 47,
  raw_text = $nhg$BEUERMANN (3B, 18, c) obelisk, red granite, exc cond, vase on ornate top On front: "Beuermannn On left: "Adolph / Beuermann / born / Dec. 24, 1819, / died / Oct. 27, 1896" On right: "Charlotte/ Beuermann / born / Nov. 20, 1824, / died / Jan. 25, 1905"$nhg$,
  inscription_text = $nhg$Beuermannn Adolph / Beuermann / born / Dec. 24, 1819, / died / Oct. 27, 1896 Charlotte/ Beuermann / born / Nov. 20, 1824, / died / Jan. 25, 1905$nhg$,
  parsed_years = ARRAY[1819, 1824, 1896, 1905]::integer[],
  source_entry = jsonb_build_object('heading', 'BEUERMANN (3B, 18, c) obelisk, red granite, exc cond, vase on ornate top On front:', 'descriptor', 'obelisk, red granite, exc cond, vase on ornate top On front:'),
  updated_at = now()
WHERE source_page_index = 15
  AND source_page_number = 194
  AND source_line_start = 43
  AND name_text = 'BEUERMANN';

WITH page_194_batches AS (
  SELECT DISTINCT batch_id, cemetery_id, source_page_index
  FROM north_hills_ocr_entries
  WHERE source_page_index = 15
    AND source_page_number = 194
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
  194,
  49,
  51,
  $nhg$[BEUERMANN] (3B, 19, s) upright, white marble, poor cond. On top: "Mother'' On front: "Dearest loved one we / have laid her in the / peaceful graves embrace / but thy memory will / be cherished till we I meet thy heavenly face."$nhg$,
  '[BEUERMANN]',
  ARRAY['BEUERMANN']::text[],
  'B',
  3,
  19,
  'single',
  'upright',
  'marble',
  'poor',
  $nhg$Mother' Dearest loved one we / have laid her in the / peaceful graves embrace / but thy memory will / be cherished till we I meet thy heavenly face.$nhg$,
  ARRAY[]::integer[],
  'medium',
  ARRAY['No four-digit years were detected in the entry text.']::text[],
  jsonb_build_object('heading', '[BEUERMANN] (3B, 19, s) upright, white marble, poor cond. On top:', 'descriptor', 'upright, white marble, poor cond. On top:')
FROM page_194_batches
ON CONFLICT (batch_id, source_page_index, source_line_start) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_entries WHERE source_page_index = 15 AND source_page_number = 194 AND source_line_start IN (35, 37, 49);
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
