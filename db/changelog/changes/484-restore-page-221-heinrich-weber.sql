--liquibase formatted sql

--changeset cemeterymapping:484-restore-page-221-heinrich-weber splitStatements:false
-- Source: cemetery administrator's supplied transcription of NHG printed page 221.
-- Slot 7 is a synthetic insertion locator before WEBER/FLAEHIN, not a verified scan line.
-- Preserve the ambiguous CRG "f." literally; do not infer an event or update burial dates.
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id='TLC-HS-0440' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM headstones h
    JOIN gravesites g ON g.id=h.gravesite_uuid AND g.deleted_at IS NULL
    JOIN north_hills_ocr_entries e ON e.cemetery_id=g.cemetery_id
    JOIN north_hills_ocr_entry_headstone_links l ON l.entry_id=e.id AND l.status='linked'
    JOIN headstones neighbor ON neighbor.id=l.headstone_uuid AND neighbor.headstone_id='TLC-HS-0441' AND neighbor.deleted_at IS NULL
    WHERE h.headstone_id='TLC-HS-0440' AND h.deleted_at IS NULL
      AND g.gravesite_id='TLC-GPS-0440' AND g.section_id='D'
      AND h.inscription ILIKE '%HEINRICH WEBER%' AND h.inscription ILIKE '%1880%'
      AND e.source_page_number=221 AND e.source_page_index=42
      AND e.parsed_section_name='D' AND e.parsed_row_number=2 AND e.parsed_position_number=2
      AND e.name_text='WEBER/FLAEHIN'
  ),
  'Heinrich Weber restoration requires the existing matching D-0440 marker and linked page 221 Anna Maria Weber source'
);

WITH source_context AS (
  SELECT DISTINCT e.batch_id,e.cemetery_id
  FROM north_hills_ocr_entries e
  JOIN north_hills_ocr_entry_headstone_links l ON l.entry_id=e.id AND l.status='linked'
  JOIN headstones neighbor ON neighbor.id=l.headstone_uuid AND neighbor.headstone_id='TLC-HS-0441' AND neighbor.deleted_at IS NULL
  JOIN gravesites g ON g.cemetery_id=e.cemetery_id AND g.gravesite_id='TLC-GPS-0440' AND g.deleted_at IS NULL
  JOIN headstones h ON h.gravesite_uuid=g.id AND h.headstone_id='TLC-HS-0440' AND h.deleted_at IS NULL
  WHERE e.source_page_number=221 AND e.source_page_index=42
    AND e.parsed_section_name='D' AND e.parsed_row_number=2 AND e.parsed_position_number=2
    AND e.name_text='WEBER/FLAEHIN'
)
INSERT INTO north_hills_ocr_entries (
  batch_id,cemetery_id,source_page_index,source_page_number,source_line_start,source_line_end,
  raw_text,name_text,surnames,parsed_section_name,parsed_row_number,parsed_position_number,
  parsed_marker_scope,marker_type_text,material_text,condition_text,inscription_text,
  parsed_years,parse_confidence,parse_notes,status,source_entry
)
SELECT batch_id,cemetery_id,42,221,7,7,
  $nhg$WEBER (2D, 1, s) upright, white marble, poor cond, hand with upraised index finger "Heinrich Weber / gestorben(?) / 21 [-] 1880 / [] jahr / [-] / [ 4 illegible lines]" Note: stone is same design as (2D, 2) CRG: Weber, Heinrich, f. July 23, 1880 (balance illegible)$nhg$,
  'WEBER',ARRAY['WEBER'],'D',2,1,'single','upright','marble','poor',
  'Heinrich Weber / gestorben(?) / 21 [-] 1880 / [] jahr / [-] / [ 4 illegible lines]',
  ARRAY[1880],'high',
  ARRAY['Note: stone is same design as (2D, 2)',
    'Restored from administrator-supplied page 221 transcription. Source line 7 is a synthetic insertion locator, not a verified scan line. Historical poor condition is not a current inspection. CRG abbreviation f. is retained without interpretation.'],
  'reviewed',jsonb_build_object(
    'repair','484-restore-page-221-heinrich-weber',
    'heading','WEBER (2D, 1, s) upright, white marble, poor cond, hand with upraised index finger',
    'descriptor','upright, white marble, poor cond, hand with upraised index finger',
    'source_basis','Administrator-supplied transcription of printed page 221',
    'source_line_locator','Synthetic insertion slot before WEBER/FLAEHIN; scan line numbers unverified',
    'note','stone is same design as (2D, 2)',
    'crg_text','Weber, Heinrich, f. July 23, 1880 (balance illegible)'
  )
FROM source_context context
WHERE NOT EXISTS (
  SELECT 1 FROM north_hills_ocr_entries e WHERE e.batch_id=context.batch_id
    AND e.source_page_number=221 AND e.parsed_section_name='D'
    AND e.parsed_row_number=2 AND e.parsed_position_number=1
);

INSERT INTO north_hills_ocr_entry_headstone_links (entry_id,headstone_uuid,status,confidence,notes)
SELECT e.id,h.id,'linked','high',
  'Administrator-supplied NHG page 221 (2D, 1, s): Heinrich Weber name and partial 1880 inscription match existing TLC-HS-0440 in D-0440. Current monument and burial data preserved.'
FROM north_hills_ocr_entries e
JOIN gravesites g ON g.cemetery_id=e.cemetery_id AND g.gravesite_id='TLC-GPS-0440' AND g.deleted_at IS NULL
JOIN headstones h ON h.gravesite_uuid=g.id AND h.headstone_id='TLC-HS-0440' AND h.deleted_at IS NULL
WHERE e.source_entry->>'repair'='484-restore-page-221-heinrich-weber'
ON CONFLICT (entry_id,headstone_uuid) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (
  entry_id,source_code,source_label,fact_type,fact_value,fact_date,raw_text,confidence,status,review_notes
)
SELECT e.id,'CRG','Church Records in German','note',
  'Weber, Heinrich, f. July 23, 1880 (balance illegible)',NULL::date,
  'CRG: Weber, Heinrich, f. July 23, 1880 (balance illegible)','review','reviewed',
  'Retained verbatim from the supplied NHG excerpt. The abbreviation f. and event meaning are unconfirmed; no burial date is inferred or promoted.'
FROM north_hills_ocr_entries e
WHERE e.source_entry->>'repair'='484-restore-page-221-heinrich-weber'
ON CONFLICT (entry_id,source_code,fact_type,fact_value) DO NOTHING;

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_entry->>'repair'='484-restore-page-221-heinrich-weber');
--rollback DELETE FROM north_hills_ocr_entry_headstone_links WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_entry->>'repair'='484-restore-page-221-heinrich-weber');
--rollback DELETE FROM north_hills_ocr_entries WHERE source_entry->>'repair'='484-restore-page-221-heinrich-weber';
