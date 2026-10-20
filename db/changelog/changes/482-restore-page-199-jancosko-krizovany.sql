--liquibase formatted sql

--changeset cemeterymapping:482-restore-page-199-jancosko-krizovany splitStatements:false
-- Source: user-supplied transcription of NHG printed page 199, after HUBERT (2C, 14, c).
-- Preserve the two gaps as historical source context, not gravesites or inscriptions.
-- Slot 9 is an insertion locator after the existing HUBERT entry, not a verified scan line.
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0188' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM north_hills_ocr_entries e
    JOIN north_hills_ocr_entry_headstone_links l ON l.entry_id = e.id AND l.status = 'linked'
    JOIN headstones anchor ON anchor.id = l.headstone_uuid AND anchor.headstone_id = 'TLC-HS-0187' AND anchor.deleted_at IS NULL
    JOIN gravesites g ON g.id = anchor.gravesite_uuid AND g.cemetery_id = e.cemetery_id AND g.deleted_at IS NULL
    JOIN headstones target ON target.headstone_id = 'TLC-HS-0188' AND target.deleted_at IS NULL
    WHERE e.source_page_number = 199 AND e.source_page_index = 20
      AND e.name_text = 'HUBERT' AND e.parsed_section_name = 'C'
      AND e.parsed_row_number = 2 AND e.parsed_position_number = 14
      AND target.inscription ILIKE '%JANCOSKO%' AND target.inscription ILIKE '%KRIZOVANY%'
      AND target.inscription ILIKE '%1952%' AND target.inscription ILIKE '%2002%'
  ),
  'Jancosko/Krizovany restoration requires the linked page 199 Hubert source and matching existing TLC-HS-0188 inscription'
);

WITH source_context AS (
  SELECT DISTINCT e.batch_id, e.cemetery_id
  FROM north_hills_ocr_entries e
  JOIN north_hills_ocr_entry_headstone_links l ON l.entry_id = e.id AND l.status = 'linked'
  JOIN headstones h ON h.id = l.headstone_uuid AND h.headstone_id = 'TLC-HS-0187' AND h.deleted_at IS NULL
  WHERE e.source_page_number = 199 AND e.source_page_index = 20
    AND e.parsed_section_name = 'C' AND e.parsed_row_number = 2 AND e.parsed_position_number = 14
    AND e.name_text = 'HUBERT'
    AND EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0188' AND deleted_at IS NULL)
)
INSERT INTO north_hills_ocr_entries (
  batch_id, cemetery_id, source_page_index, source_page_number, source_line_start, source_line_end,
  raw_text, name_text, surnames, parsed_section_name, parsed_row_number, parsed_position_number,
  parsed_marker_scope, marker_type_text, material_text, condition_text, inscription_text,
  parsed_years, parse_confidence, parse_notes, status, source_entry
)
SELECT batch_id, cemetery_id, 20, 199, 9, 9,
  $nhg$Gap, about 12 feet. JANCOSKO/KRIZOVANY (2C, 15, c) upright, gray granite, exc cond, roses & leaves, lamb, cross "Jancosko / Ronald Michael / March 13, 1952 / Krizovany / Carol Lynne / July 7, 1951 / Feb. 28, 2002" On back: "Jancosko" Vase in ground. Gap, about 35 feet.$nhg$,
  'JANCOSKO/KRIZOVANY', ARRAY['JANCOSKO','KRIZOVANY'], 'C', 2, 15,
  'couple', 'upright', 'granite', 'excellent',
  'Jancosko / Ronald Michael / March 13, 1952 / Krizovany / Carol Lynne / July 7, 1951 / Feb. 28, 2002',
  ARRAY[1952,1951,2002], 'high',
  ARRAY['Restored from user-supplied page 199 transcription. Source line 9 is a synthetic insertion locator after HUBERT, not a verified scan line. Historical condition is not a current inspection.'],
  'reviewed', jsonb_build_object(
    'repair', '482-restore-page-199-jancosko-krizovany',
    'heading', 'JANCOSKO/KRIZOVANY (2C, 15, c) upright, gray granite, exc cond, roses & leaves, lamb, cross',
    'descriptor', 'upright, gray granite, exc cond, roses & leaves, lamb, cross',
    'preceding_gap_text', 'Gap, about 12 feet.', 'following_gap_text', 'Gap, about 35 feet.',
    'back_inscription', 'Jancosko', 'vase_description', 'Vase in ground',
    'source_basis', 'User-supplied transcription of printed page 199',
    'source_line_locator', 'Synthetic insertion slot after HUBERT; scan line numbers unverified'
  )
FROM source_context context
WHERE NOT EXISTS (
  SELECT 1 FROM north_hills_ocr_entries e WHERE e.batch_id = context.batch_id
    AND e.source_page_number = 199 AND e.parsed_section_name = 'C'
    AND e.parsed_row_number = 2 AND e.parsed_position_number = 15
);

INSERT INTO north_hills_ocr_entry_headstone_links (entry_id, headstone_uuid, status, confidence, notes)
SELECT e.id, h.id, 'linked', 'high',
  'User-supplied NHG page 199 (2C, 15, c): both names and dates match existing TLC-HS-0188. Restored missing source reading; current inscription, condition, and inspection date preserved.'
FROM north_hills_ocr_entries e
JOIN headstones h ON h.headstone_id = 'TLC-HS-0188' AND h.deleted_at IS NULL
WHERE e.source_entry->>'repair' = '482-restore-page-199-jancosko-krizovany'
ON CONFLICT (entry_id, headstone_uuid) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_entry_headstone_links WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_entry->>'repair' = '482-restore-page-199-jancosko-krizovany');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_entry->>'repair' = '482-restore-page-199-jancosko-krizovany';
