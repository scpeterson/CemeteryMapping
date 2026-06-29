--liquibase formatted sql

--changeset cemeterymapping:148-repair-north-hills-page-185
UPDATE north_hills_ocr_entries
SET
  raw_text = 'SCHRAMM (4A, 1, s) pillow, gray granite, exc cond "John W. Schramm/ 1886-1948" CR: d. May 3, 1948, 62y 2m 2da',
  inscription_text = 'John W. Schramm/ 1886-1948',
  source_entry = jsonb_build_object(
    'heading', 'SCHRAMM (4A, 1, s) pillow, gray granite, exc cond',
    'descriptor', 'pillow, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 185
  AND source_line_start = 10
  AND name_text = 'SCHRAMM';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'SCHRAMM/PFEIFFER (4A, 2, s) pillow, gray granite, exc cond "Lillian O. Schramm / 1884-1968" CR: Middle name Olive, d. May 7, 1968, 84y 2m, last of Pfeiffer family',
  inscription_text = 'Lillian O. Schramm / 1884-1968',
  source_entry = jsonb_build_object(
    'heading', 'SCHRAMM/PFEIFFER (4A, 2, s) pillow, gray granite, exc cond',
    'descriptor', 'pillow, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 185
  AND source_line_start = 13
  AND name_text = 'SCHRAMM/PFEIFFER';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'HARRIS/ POWELL (4A, 3, s) pillow, gray granite, exc cond "George Powell Harris/ Seaman 1/C USNR / enlisted / April 17, 1944 / born / July 27, 1909 / discharged / Jan. 6, 1946 / died Jan. 7, 1965" Separate flag holder: "American / US / Legion", star',
  inscription_text = 'George Powell Harris/ Seaman 1/C USNR / enlisted / April 17, 1944 / born / July 27, 1909 / discharged / Jan. 6, 1946 / died Jan. 7, 1965 American / US / Legion',
  source_entry = jsonb_build_object(
    'heading', 'HARRIS/ POWELL (4A, 3, s) pillow, gray granite, exc cond',
    'descriptor', 'pillow, gray granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 185
  AND source_line_start = 17
  AND name_text = 'HARRIS/ POWELL';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'FARK (4A, 4, c) upright, pink granite, exc cond, candles, flowers "Fark / H. Ernest / 1876-1963 / Father / Elizabeth I. / 1879-1961 / Mother" On back: "Fark"',
  inscription_text = 'Fark / H. Ernest / 1876-1963 / Father / Elizabeth I. / 1879-1961 / Mother Fark',
  source_entry = jsonb_build_object(
    'heading', 'FARK (4A, 4, c) upright, pink granite, exc cond, candles, flowers',
    'descriptor', 'upright, pink granite, exc cond, candles, flowers'
  ),
  updated_at = now()
WHERE source_page_number = 185
  AND source_line_start = 22
  AND name_text = 'FARK';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'RITCHIE (4A, 7, c) upright, gray granite, exc cond, flower spray "Ritchie / Morrison/ 1854-1917 / Regina C. / 1869-1955" On base: "Rock of Ages" in circle. On back: "Ritchie"',
  inscription_text = 'Ritchie / Morrison/ 1854-1917 / Regina C. / 1869-1955 Rock of Ages Ritchie',
  source_entry = jsonb_build_object(
    'heading', 'RITCHIE (4A, 7, c) upright, gray granite, exc cond, flower spray',
    'descriptor', 'upright, gray granite, exc cond, flower spray'
  ),
  updated_at = now()
WHERE source_page_number = 185
  AND source_line_start = 35
  AND name_text = 'RITCHIE';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'BRANDT (4A, 9, c) upright, gray granite, exc cond, band of flower and leaves "Brandt/ Peter/ 1847-1935 /Margaret/ 1852-1943" On back: "Brandt" CR: Peter, d. August 25, 1935, 88y. Margaret, d. August 22, 1943',
  source_entry = jsonb_build_object(
    'heading', 'BRANDT (4A, 9, c) upright, gray granite, exc cond, band of flower and leaves',
    'descriptor', 'upright, gray granite, exc cond, band of flower and leaves'
  ),
  updated_at = now()
WHERE source_page_number = 185
  AND source_line_start = 42
  AND name_text = 'BRANDT';

UPDATE north_hills_ocr_entries
SET
  raw_text = 'PFEIFFER (5A, 1, c) upright, orange granite, exc cond "Pfeiffer / 1890 Harry R. 1986 / Walter H. / Nov. 7, 1886 / Sept. 2, 1973 / Lynn C. / June 7, 1894 / April 18, 1981" CR: Harry, middle name Ralph, Aug. 29, 1890 - Jan. 23, 1986',
  inscription_text = 'Pfeiffer / 1890 Harry R. 1986 / Walter H. / Nov. 7, 1886 / Sept. 2, 1973 / Lynn C. / June 7, 1894 / April 18, 1981',
  parsed_years = ARRAY[1886, 1890, 1894, 1973, 1981, 1986]::integer[],
  source_entry = jsonb_build_object(
    'heading', 'PFEIFFER (5A, 1, c) upright, orange granite, exc cond',
    'descriptor', 'upright, orange granite, exc cond'
  ),
  updated_at = now()
WHERE source_page_number = 185
  AND source_line_start = 48
  AND name_text = 'PFEIFFER';

DELETE FROM north_hills_ocr_source_facts
WHERE entry_id IN (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 185
    AND source_line_start IN (10, 13, 42, 48)
)
AND source_code = 'CR';

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT id, 'CR', 'Church Records', 'note', 'd. May 3, 1948, 62y 2m 2da', NULL::date, 'CR: d. May 3, 1948, 62y 2m 2da', 'review'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 10 AND name_text = 'SCHRAMM'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 3, 1948', DATE '1948-05-03', 'CR: d. May 3, 1948, 62y 2m 2da', 'high'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 10 AND name_text = 'SCHRAMM'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '62y 2m 2d', NULL::date, 'CR: d. May 3, 1948, 62y 2m 2da', 'medium'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 10 AND name_text = 'SCHRAMM'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Middle name Olive, d. May 7, 1968, 84y 2m, last of Pfeiffer family', NULL::date, 'CR: Middle name Olive, d. May 7, 1968, 84y 2m, last of Pfeiffer family', 'review'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 13 AND name_text = 'SCHRAMM/PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'May 7, 1968', DATE '1968-05-07', 'CR: Middle name Olive, d. May 7, 1968, 84y 2m, last of Pfeiffer family', 'high'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 13 AND name_text = 'SCHRAMM/PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '84y 2m', NULL::date, 'CR: Middle name Olive, d. May 7, 1968, 84y 2m, last of Pfeiffer family', 'medium'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 13 AND name_text = 'SCHRAMM/PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Peter, d. August 25, 1935, 88y. Margaret, d. August 22, 1943', NULL::date, 'CR: Peter, d. August 25, 1935, 88y. Margaret, d. August 22, 1943', 'review'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 42 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 25, 1935', DATE '1935-08-25', 'CR: Peter, d. August 25, 1935, 88y. Margaret, d. August 22, 1943', 'high'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 42 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'August 22, 1943', DATE '1943-08-22', 'CR: Peter, d. August 25, 1935, 88y. Margaret, d. August 22, 1943', 'high'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 42 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'age_at_death', '88y', NULL::date, 'CR: Peter, d. August 25, 1935, 88y. Margaret, d. August 22, 1943', 'medium'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 42 AND name_text = 'BRANDT'
UNION ALL
SELECT id, 'CR', 'Church Records', 'note', 'Harry, middle name Ralph, Aug. 29, 1890 - Jan. 23, 1986', NULL::date, 'CR: Harry, middle name Ralph, Aug. 29, 1890 - Jan. 23, 1986', 'review'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 48 AND name_text = 'PFEIFFER'
UNION ALL
SELECT id, 'CR', 'Church Records', 'death_date', 'January 23, 1986', DATE '1986-01-23', 'CR: Harry, middle name Ralph, Aug. 29, 1890 - Jan. 23, 1986', 'high'
FROM north_hills_ocr_entries
WHERE source_page_number = 185 AND source_line_start = 48 AND name_text = 'PFEIFFER'
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 185 AND source_line_start IN (10, 13, 42, 48)) AND source_code = 'CR';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'north_hills_ocr_source_facts';
