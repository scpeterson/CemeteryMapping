--liquibase formatted sql

--changeset cemeterymapping:397-restore-nhg-steele-mehrlick-page-188 splitStatements:false
-- Source: NHG printed page 188, PDF page 9, extracted lines 29-32.
-- The scan reads MEHRLICK / Mehrlick; retain supplied OCR variants as provenance.
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0066' AND deleted_at IS NULL)
  OR (EXISTS (SELECT 1 FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_page_index = 9)
    AND (SELECT count(*) FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0066', 'TLC-GPS-0066-01') AND deleted_at IS NULL) = 2
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      JOIN headstones h ON h.id = hb.headstone_uuid
      WHERE h.headstone_id = 'TLC-HS-0066' AND h.deleted_at IS NULL AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
        AND ((b.full_name = 'Wilbert B Steele' AND b.death_date = DATE '1941-04-27')
          OR (b.full_name = 'Anna S Steele' AND b.death_date = DATE '1959-02-13'))) = 2),
  'Steele marker requires page 188 source context, both split gravesites, and the two existing matching burial dates'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM north_hills_ocr_entries WHERE source_page_number = 188 AND source_page_index = 9 AND source_line_start = 29),
  'page 188 line 29 must be unused before restoring the missing Steele reading'
);

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text,
  parsed_years, parse_confidence, parse_notes, status, source_entry
)
SELECT DISTINCT e.batch_id, g.cemetery_id, 9, 188, 29, 32,
  'STEELE/MEHRLICK (8A, 1, c) upright, gray granite, exc cond, flowers "Steele / Wilbert B. / 1876-1941 / Father / Anna. S / 1874-1959 / Mother" CR: Wilbert, d. April 27, 1941. Anna S. Steele Mehrlick, d. February 13, 1959, 84y 10m 20da',
  'STEELE/MEHRLICK', ARRAY['STEELE', 'MEHRLICK'], 'A', 8, 1, 'couple', 'upright', 'granite', 'excellent',
  'Steele / Wilbert B. / 1876-1941 / Father / Anna. S / 1874-1959 / Mother',
  ARRAY[1876, 1941, 1874, 1959], 'high',
  ARRAY['Restored missing reading after visual review of PDF page 9 / printed page 188 on 2026-09-16. Scan reads MEHRLICK / Mehrlick; supplied OCR variants MEHRUCK / Mehrtick retained in source metadata. Historical marker condition is source evidence, not a current inspection.'],
  'reviewed', jsonb_build_object(
    'heading', 'STEELE/MEHRLICK (8A, 1, c) upright, gray granite, exc cond, flowers',
    'descriptor', 'upright, gray granite, exc cond, flowers',
    'repair', '397-restore-nhg-steele-mehrlick-page-188',
    'supplied_ocr', 'STEELE/MEHRUCK (8A, 1, c) upright, gray granite, exc cond, flowers "Steele / Wilbert B. / 1876-1941 / Father/ Anna. S / 1874-1959 / Mother" CR: Wilbert, d. April 27, 1941. Anna S. Steele Mehrtick, d. February 13, 1959, 84y 10m 20da')
FROM north_hills_ocr_entries e
JOIN gravesites g ON g.cemetery_id = e.cemetery_id AND g.gravesite_id = 'TLC-GPS-0066' AND g.deleted_at IS NULL
JOIN headstones h ON h.gravesite_uuid = g.id AND h.headstone_id = 'TLC-HS-0066' AND h.deleted_at IS NULL
WHERE e.source_page_number = 188 AND e.source_page_index = 9;

INSERT INTO north_hills_ocr_source_facts
  (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence, status, review_notes, reviewed_at)
SELECT e.id, 'CR', 'Church Records', f.kind, f.value, f.date_value,
  'CR: Wilbert, d. April 27, 1941. Anna S. Steele Mehrlick, d. February 13, 1959, 84y 10m 20da',
  'high', 'reviewed', f.notes, now()
FROM north_hills_ocr_entries e CROSS JOIN (VALUES
  ('death_date', 'Wilbert: April 27, 1941', DATE '1941-04-27', 'Applies to Wilbert B Steele, A-0066; matches existing burial death date.'),
  ('death_date', 'Anna S. Steele Mehrlick: February 13, 1959', DATE '1959-02-13', 'Applies to Anna S Steele, A-0066A; matches existing burial death date.'),
  ('age_at_death', 'Anna S. Steele Mehrlick: 84y 10m 20da', NULL::date, 'Reported age from Church Records as quoted by NHG; no exact birth date inferred.'),
  ('note', 'Anna S. Steele Mehrlick', NULL::date, 'Name as printed in the NHG Church Records excerpt; does not establish whether Mehrlick is a maiden or later surname.')
) AS f(kind, value, date_value, notes)
WHERE e.source_entry->>'repair' = '397-restore-nhg-steele-mehrlick-page-188';

INSERT INTO north_hills_ocr_entry_headstone_links (entry_id, headstone_uuid, status, confidence, notes)
SELECT e.id, h.id, 'linked', 'high', 'Page 188 (8A, 1, c): names and years match TLC-HS-0066; visually verified 2026-09-16.'
FROM north_hills_ocr_entries e JOIN gravesites g ON g.cemetery_id = e.cemetery_id AND g.gravesite_id = 'TLC-GPS-0066' AND g.deleted_at IS NULL
JOIN headstones h ON h.gravesite_uuid = g.id AND h.headstone_id = 'TLC-HS-0066' AND h.deleted_at IS NULL
WHERE e.source_entry->>'repair' = '397-restore-nhg-steele-mehrlick-page-188';

INSERT INTO north_hills_ocr_entry_gravesite_links (entry_id, gravesite_uuid, status, confidence, notes)
SELECT e.id, g.id, 'linked', 'high', 'Shared Steele marker reading covers Wilbert in A-0066 and Anna in A-0066A.'
FROM north_hills_ocr_entries e JOIN gravesites g ON g.cemetery_id = e.cemetery_id
  AND g.gravesite_id IN ('TLC-GPS-0066', 'TLC-GPS-0066-01') AND g.deleted_at IS NULL
WHERE e.source_entry->>'repair' = '397-restore-nhg-steele-mehrlick-page-188';

UPDATE burials b
SET notes = concat_ws(' ', NULLIF(b.notes, ''), 'NHG, printed page 188 (8A, 1, c), quoting Church Records: Anna S. Steele Mehrlick, d. February 13, 1959, 84y 10m 20da. Scan surname reads Mehrlick; supplied OCR variants MEHRUCK/Mehrtick are retained in the linked source reading. No exact birth date or surname relationship inferred.'), updated_at = now()
WHERE b.full_name = 'Anna S Steele' AND b.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM headstone_burials hb JOIN headstones h ON h.id = hb.headstone_uuid
    WHERE hb.burial_uuid = b.id AND hb.deleted_at IS NULL AND h.headstone_id = 'TLC-HS-0066' AND h.deleted_at IS NULL);

--rollback empty
