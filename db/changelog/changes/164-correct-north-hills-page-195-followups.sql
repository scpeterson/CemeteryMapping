--liquibase formatted sql

--changeset cemeterymapping:164-correct-north-hills-page-195-followups
UPDATE north_hills_ocr_entries
SET
  raw_text = 'SCHNABEL (3B, 26, s) upright with open ledger, gray granite, ,exc cond "Henry Schnabel / 1856-1904"',
  parse_notes = ARRAY[]::text[],
  source_entry = jsonb_build_object(
    'heading',
    'SCHNABEL (3B, 26, s) upright with open ledger, gray granite, ,exc cond',
    'descriptor',
    'upright with open ledger, gray granite, ,exc cond'
  )
WHERE source_page_number = 195
  AND source_line_start = 39
  AND name_text = 'SCHNABEL';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$LOEFFLER (4B, 1, s) upright, white marble, poor cond, sunken, fallen, lamb "John E / [-] / Loeffler / [-] / [-] Aug. 1887 / [2 Illegible lines]"$nhg$,
  name_text = 'LOEFFLER',
  surnames = ARRAY['LOEFFLER']::text[],
  source_entry = jsonb_build_object(
    'heading',
    'LOEFFLER (4B, 1, s) upright, white marble, poor cond, sunken, fallen, lamb',
    'descriptor',
    'upright, white marble, poor cond, sunken, fallen, lamb'
  )
WHERE source_page_number = 195
  AND source_line_start = 43
  AND name_text = $nhg$LOEFFL'ER$nhg$;

--rollback UPDATE north_hills_ocr_entries SET raw_text = 'SCHNABEL (38, 26, s) upright with open ledger, gray granite, ,exc cond "Henry Schnabel / 1856-1904"', parse_notes = ARRAY['NHG OCR/location text uses "38"; parsed as row 3, section B.']::text[], source_entry = jsonb_build_object('heading', 'SCHNABEL (38, 26, s) upright with open ledger, gray granite, ,exc cond', 'descriptor', 'upright with open ledger, gray granite, ,exc cond') WHERE source_page_number = 195 AND source_line_start = 39 AND name_text = 'SCHNABEL';
--rollback UPDATE north_hills_ocr_entries SET raw_text = $nhg$LOEFFL'ER (4B, 1, s) upright, white marble, poor cond, sunken, fallen, lamb "John E / [-] / Loeffler / [-] / [-] Aug. 1887 / [2 Illegible lines]"$nhg$, name_text = $nhg$LOEFFL'ER$nhg$, surnames = ARRAY[$nhg$LOEFFL'ER$nhg$]::text[], source_entry = jsonb_build_object('heading', $nhg$LOEFFL'ER (4B, 1, s) upright, white marble, poor cond, sunken, fallen, lamb$nhg$, 'descriptor', 'upright, white marble, poor cond, sunken, fallen, lamb') WHERE source_page_number = 195 AND source_line_start = 43 AND name_text = 'LOEFFLER';
