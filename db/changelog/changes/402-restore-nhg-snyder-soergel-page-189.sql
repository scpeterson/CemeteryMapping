--liquibase formatted sql

--changeset cemeterymapping:402-restore-nhg-snyder-soergel-page-189 splitStatements:false
-- NHG printed page 189, PDF page 10, extracted lines 9-10.
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0072' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM headstones h
    JOIN gravesites g ON g.id = h.gravesite_uuid AND g.deleted_at IS NULL
    JOIN headstone_burials hb ON hb.headstone_uuid = h.id AND hb.deleted_at IS NULL
    JOIN burials b ON b.id = hb.burial_uuid AND b.deleted_at IS NULL
    WHERE h.headstone_id = 'TLC-HS-0072' AND h.deleted_at IS NULL
      AND g.gravesite_id = 'TLC-GPS-0072' AND g.section_id = 'A'
      AND b.gravesite_uuid = g.id AND b.full_name = 'Katherine Snyder' AND b.maiden_name = 'Soergel'
      AND b.birth_date_text = '1865' AND b.death_date_text = '1937'
      AND EXISTS (SELECT 1 FROM north_hills_ocr_entries e WHERE e.cemetery_id = g.cemetery_id
        AND e.source_page_number = 189 AND e.source_page_index = 10)
  ),
  'Snyder marker requires matching Katherine Soergel Snyder burial in A-0072 and page 189 source context'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM north_hills_ocr_entries e
    JOIN gravesites g ON g.cemetery_id = e.cemetery_id AND g.gravesite_id = 'TLC-GPS-0072' AND g.deleted_at IS NULL
    WHERE e.source_page_number = 189 AND e.source_page_index = 10
      AND (e.source_line_start = 9 OR e.name_text = 'SNYDER/SOERGEL')
  ),
  'page 189 Snyder/Soergel reading must be missing before restoration'
);

INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text,
  parsed_years, parse_confidence, parse_notes, status, source_entry
)
SELECT DISTINCT e.batch_id, g.cemetery_id, 10, 189, 9, 10,
  'SNYDER/SOERGEL (8A, 7, s) upright, gray granite, exc cond, cross "Katherine Soergel / wife of / Peter Snyder / 1865-1937 / Mother"',
  'SNYDER/SOERGEL', ARRAY['SNYDER', 'SOERGEL'], 'A', 8, 7, 'single', 'upright', 'granite', 'excellent',
  'Katherine Soergel / wife of / Peter Snyder / 1865-1937 / Mother',
  ARRAY[1865, 1937], 'high',
  ARRAY['Restored missing reading after visual review of PDF page 10 / printed page 189 on 2026-09-17. Scan reads 8A; extracted OCR reads BA. Historical condition is source evidence, not a current inspection. Peter Snyder is named as spouse, not as a second burial.'],
  'reviewed', jsonb_build_object(
    'heading', 'SNYDER/SOERGEL (8A, 7, s) upright, gray granite, exc cond, cross',
    'descriptor', 'upright, gray granite, exc cond, cross',
    'repair', '402-restore-nhg-snyder-soergel-page-189',
    'extracted_ocr', 'SNYDER/SOERGEL (BA, 7, s) upright, gray granite, exc cond, cross "Katherine Soergel / wife of/ Peter Snyder/ 1865-1937 / Mother"')
FROM north_hills_ocr_entries e
JOIN gravesites g ON g.cemetery_id = e.cemetery_id AND g.gravesite_id = 'TLC-GPS-0072' AND g.deleted_at IS NULL
JOIN headstones h ON h.gravesite_uuid = g.id AND h.headstone_id = 'TLC-HS-0072' AND h.deleted_at IS NULL
WHERE e.source_page_number = 189 AND e.source_page_index = 10;

INSERT INTO north_hills_ocr_entry_headstone_links (entry_id, headstone_uuid, status, confidence, notes)
SELECT e.id, h.id, 'linked', 'high', 'Page 189 (8A, 7, s): inscription and years match TLC-HS-0072; visually verified 2026-09-17.'
FROM north_hills_ocr_entries e
JOIN gravesites g ON g.cemetery_id = e.cemetery_id AND g.gravesite_id = 'TLC-GPS-0072' AND g.deleted_at IS NULL
JOIN headstones h ON h.gravesite_uuid = g.id AND h.headstone_id = 'TLC-HS-0072' AND h.deleted_at IS NULL
WHERE e.source_entry->>'repair' = '402-restore-nhg-snyder-soergel-page-189';

INSERT INTO north_hills_ocr_entry_gravesite_links (entry_id, gravesite_uuid, status, confidence, notes)
SELECT e.id, g.id, 'linked', 'high', 'Katherine Soergel, wife of Peter Snyder, 1865-1937; matches Katherine Snyder in A-0072.'
FROM north_hills_ocr_entries e
JOIN gravesites g ON g.cemetery_id = e.cemetery_id AND g.gravesite_id = 'TLC-GPS-0072' AND g.deleted_at IS NULL
WHERE e.source_entry->>'repair' = '402-restore-nhg-snyder-soergel-page-189';

--rollback empty
