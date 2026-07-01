--liquibase formatted sql

--changeset cemeterymapping:166-repair-north-hills-page-197
UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$WILL/BRUERMANN/PFEIFFER (6B, 2, s) upright, marble, poor cond, sunken, fallen, lamb "Amanda L. / tochter von(?) / F. & E. Will/ geboren / 24 Jan. 1883 / gestorben / 11 April 1888 / [Illegible lines]" CRG: Amanda Luella Will, daughter of Frank & Elisabeth nee Bruermann/Pfeiffer wife of Gottlieb Pfeiffer, f. April 11, 1888$nhg$,
  source_entry = jsonb_build_object('heading', 'WILL/BRUERMANN/PFEIFFER (6B, 2, s) upright, marble, poor cond, sunken, fallen, lamb', 'descriptor', 'upright, marble, poor cond, sunken, fallen, lamb'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 9
  AND name_text = 'WILL/BRUERMANN/PFEIFFER';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = $nhg$Amanda Luella Will, daughter of Frank & Elisabeth nee Bruermann/Pfeiffer wife of Gottlieb Pfeiffer, f. April 11, 1888$nhg$,
  raw_text = $nhg$CRG: Amanda Luella Will, daughter of Frank & Elisabeth nee Bruermann/Pfeiffer wife of Gottlieb Pfeiffer, f. April 11, 1888$nhg$,
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 18
  AND entry.source_page_number = 197
  AND entry.source_line_start = 9
  AND entry.name_text = 'WILL/BRUERMANN/PFEIFFER'
  AND fact.source_code = 'CRG';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$HECK/HÖCH (6B, 3, s) upright, marble, poor cond, sunken, fallen, hand with upraised index finger, shield "Wilhelm J. / sohn von J(?) / Heck / [-] Feb. 187(?) / [-] Jan. 187(?) / alter 1 Jahr / 10 mo. u. 21 tag / [Illegible lines]" CRG: Wilhelm Jacob Höch, little son of Jacob & Carlina Elisabeth, f. January 21, 1875, d. 19 January, age 1y 10m 21 [da]$nhg$,
  name_text = $nhg$HECK/HÖCH$nhg$,
  surnames = ARRAY[$nhg$HECK$nhg$, $nhg$HÖCH$nhg$]::text[],
  inscription_text = $nhg$Wilhelm J. / sohn von J(?) / Heck / [-] Feb. 187(?) / [-] Jan. 187(?) / alter 1 Jahr / 10 mo. u. 21 tag / [Illegible lines]$nhg$,
  source_entry = jsonb_build_object('heading', $nhg$HECK/HÖCH (6B, 3, s) upright, marble, poor cond, sunken, fallen, hand with upraised index finger, shield$nhg$, 'descriptor', 'upright, marble, poor cond, sunken, fallen, hand with upraised index finger, shield'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 15
  AND name_text = 'HECK/HOCH';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = $nhg$Wilhelm Jacob Höch, little son of Jacob & Carlina Elisabeth, f. January 21, 1875, d. 19 January, age 1y 10m 21 [da]$nhg$,
  raw_text = $nhg$CRG: Wilhelm Jacob Höch, little son of Jacob & Carlina Elisabeth, f. January 21, 1875, d. 19 January, age 1y 10m 21 [da]$nhg$,
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 18
  AND entry.source_page_number = 197
  AND entry.source_line_start = 15
  AND entry.name_text = $nhg$HECK/HÖCH$nhg$
  AND fact.source_code = 'CRG';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SOERGEL (1C, 1, c) upright, gray granite, exc cond "Soergel / Roy R. / 1895 - 1974 / Ruby l. / 1897 - 1994" CR: Roy Robert, October 27, 1974, 78y11m 15da. Ruby, April 28, 1897 - July 15, 1994$nhg$,
  inscription_text = $nhg$Soergel / Roy R. / 1895 - 1974 / Ruby l. / 1897 - 1994$nhg$,
  source_entry = jsonb_build_object('heading', 'SOERGEL (1C, 1, c) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 23
  AND name_text = 'SOERGEL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = $nhg$Roy Robert, October 27, 1974, 78y11m 15da. Ruby, April 28, 1897 - July 15, 1994$nhg$,
  raw_text = $nhg$CR: Roy Robert, October 27, 1974, 78y11m 15da. Ruby, April 28, 1897 - July 15, 1994$nhg$,
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 18
  AND entry.source_page_number = 197
  AND entry.source_line_start = 23
  AND entry.name_text = 'SOERGEL'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SOERGEL (1C, 2, s) upright, gray granite, exc cond, flowers "Clarence W. / son of / Roy & Ruby Soergel / 1925-1931" CR: Middle name Wesley, d. June 25, 1925 - June 28, 1931$nhg$,
  inscription_text = $nhg$Clarence W. / son of / Roy & Ruby Soergel / 1925-1931$nhg$,
  source_entry = jsonb_build_object('heading', 'SOERGEL (1C, 2, s) upright, gray granite, exc cond, flowers', 'descriptor', 'upright, gray granite, exc cond, flowers'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 27
  AND name_text = 'SOERGEL';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, 'Mlddle', 'Middle'),
  raw_text = replace(fact.raw_text, 'Mlddle', 'Middle'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 18
  AND entry.source_page_number = 197
  AND entry.source_line_start = 27
  AND entry.name_text = 'SOERGEL'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$FLANDERS (1C, 3, s) pillow, pink granite, exc cond, flowers, leaves "Mary (May) Flanders/ 1903-1998 / Mother" CR: Dec. 28, 1903 - Nov. 5, 1998$nhg$,
  source_entry = jsonb_build_object('heading', 'FLANDERS (1C, 3, s) pillow, pink granite, exc cond, flowers, leaves', 'descriptor', 'pillow, pink granite, exc cond, flowers, leaves'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 31
  AND name_text = 'FLANDERS';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = 'Dec. 28, 1903 - Nov. 5, 1998',
  raw_text = 'CR: Dec. 28, 1903 - Nov. 5, 1998',
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 18
  AND entry.source_page_number = 197
  AND entry.source_line_start = 31
  AND entry.name_text = 'FLANDERS'
  AND fact.source_code = 'CR';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$GILLEN (1C, 4, s) pillow, pink granite, exc cond "Arthur l. Gillen/ 1902-1938 / Husband"$nhg$,
  source_entry = jsonb_build_object('heading', 'GILLEN (1C, 4, s) pillow, pink granite, exc cond', 'descriptor', 'pillow, pink granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 35
  AND name_text = 'GILLEN';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$GILLEN/HEEP (1C, 5, c) pillow, gray granite, exc cond "Gillen / James D. / 1875-1953 / Father / Emma Heep/ 1878-1971 / Mother"$nhg$,
  inscription_text = $nhg$Gillen / James D. / 1875-1953 / Father / Emma Heep/ 1878-1971 / Mother$nhg$,
  source_entry = jsonb_build_object('heading', 'GILLEN/HEEP (1C, 5, c) pillow, gray granite, exc cond', 'descriptor', 'pillow, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 38
  AND name_text = 'GILLEN/HEEP';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$SIMPSON (1C, 6, c) upright, gray granite, exc cond, airplane "Simpson / James H. / Aug. 15, 1922 / Sept. 13, 1995" Second side Is blank. On back: "Simpson" Separate flag holder: "US / Veteran", star CR: buried September 16, 1995, 73y$nhg$,
  inscription_text = $nhg$Simpson / James H. / Aug. 15, 1922 / Sept. 13, 1995 Simpson US / Veteran$nhg$,
  source_entry = jsonb_build_object('heading', 'SIMPSON (1C, 6, c) upright, gray granite, exc cond, airplane', 'descriptor', 'upright, gray granite, exc cond, airplane'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 41
  AND name_text = 'SIMPSON';

UPDATE north_hills_ocr_entries
SET
  source_line_end = 47,
  raw_text = $nhg$B[-] (1C, 7, s) upright, gray granite, exc cond "F. B."$nhg$,
  parse_notes = ARRAY['Balance of row, approximately 100 feet, is empty']::text[],
  source_entry = jsonb_build_object('heading', 'B[-] (1C, 7, s) upright, gray granite, exc cond', 'descriptor', 'upright, gray granite, exc cond'),
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 46
  AND name_text = 'B[-]';

UPDATE north_hills_ocr_entries
SET
  raw_text = $nhg$McWILLIAMS (2C, 1, s) pillow, gray granite, good cond, flower "Brother/ Henry McWilllams / 1909-1965" CR: Middle Initial T., d. December 16, 1965, 56y 5m 25da, "our janitor"$nhg$,
  updated_at = now()
WHERE source_page_index = 18
  AND source_page_number = 197
  AND source_line_start = 51
  AND name_text = 'McWILLIAMS';

UPDATE north_hills_ocr_source_facts fact
SET
  fact_value = replace(fact.fact_value, '56y Sm 25da', '56y 5m 25da'),
  raw_text = replace(fact.raw_text, '56y Sm 25da', '56y 5m 25da'),
  updated_at = now()
FROM north_hills_ocr_entries entry
WHERE fact.entry_id = entry.id
  AND entry.source_page_index = 18
  AND entry.source_page_number = 197
  AND entry.source_line_start = 51
  AND entry.name_text = 'McWILLIAMS'
  AND fact.source_code = 'CR';

--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
