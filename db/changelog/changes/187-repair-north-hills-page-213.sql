--liquibase formatted sql

--changeset cemeterymapping:187-repair-north-hills-page-213 splitStatements:false
WITH updated_entries AS (
  UPDATE north_hills_ocr_entries entry
  SET
    source_line_end = corrections.source_line_end,
    raw_text = corrections.raw_text,
    name_text = corrections.name_text,
    surnames = corrections.surnames,
    parsed_section_name = 'C',
    parsed_row_number = 13,
    parsed_position_number = corrections.parsed_position_number,
    parsed_marker_scope = corrections.parsed_marker_scope,
    marker_type_text = corrections.marker_type_text,
    material_text = corrections.material_text,
    condition_text = corrections.condition_text,
    inscription_text = corrections.inscription_text,
    parsed_years = corrections.parsed_years,
    parse_confidence = 'high',
    parse_notes = ARRAY[]::text[],
    source_entry = corrections.source_entry,
    updated_at = now()
  FROM (
    VALUES
      (
        8, 20, 'CAIRNS', ARRAY['CAIRNS']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$CAIRNS (13C, 8, s) pillow, gray granite, exc cond "Bessie G. Cairns / wife of / Arthur J. Cairns / 1906-1992" CR: Sept. 22, 1906 - Sept. 14, 1992$nhg$,
        $nhg$Bessie G. Cairns / wife of / Arthur J. Cairns / 1906-1992$nhg$,
        ARRAY[1906, 1992]::integer[],
        $json${"heading":"CAIRNS (13C, 8, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        9, 25, 'HAGUE', ARRAY['HAGUE']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$HAGUE (13C, 9, c) upright, gray granite, exc cond, vine of flower, leaves "Hague / Arthur J. / Oct. 7, 1904 / July 24, 1976 / Father / Isabelle M. / Sept. 26, 1908 / July 24, 1997 / Mother" On back: "Hague" CR: Arthur Julius. Isabelle, Glenn-Kildoo Funeral Home$nhg$,
        $nhg$Hague / Arthur J. / Oct. 7, 1904 / July 24, 1976 / Father / Isabelle M. / Sept. 26, 1908 / July 24, 1997 / Mother Hague$nhg$,
        ARRAY[1904, 1908, 1976, 1997]::integer[],
        $json${"heading":"HAGUE (13C, 9, c) upright, gray granite, exc cond, vine of flower, leaves","descriptor":"upright, gray granite, exc cond, vine of flower, leaves"}$json$::jsonb
      ),
      (
        10, 31, 'HAGUE', ARRAY['HAGUE']::text[], 'single', 'pillow', 'granite', 'excellent',
        $nhg$HAGUE (13C, 10, s) pillow, gray granite, exc cond "Isabelle R. Hague / 1926-1932 / Daughter" CR: Middle name Ruth, d. April 2, 1932, 5y 6m 9da$nhg$,
        $nhg$Isabelle R. Hague / 1926-1932 / Daughter$nhg$,
        ARRAY[1926, 1932]::integer[],
        $json${"heading":"HAGUE (13C, 10, s) pillow, gray granite, exc cond","descriptor":"pillow, gray granite, exc cond"}$json$::jsonb
      ),
      (
        11, 37, 'KNOBELOCH/KNOBLOCH', ARRAY['KNOBELOCH','KNOBLOCH']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$KNOBELOCH/KNOBLOCH (13C, 11, c) upright, gray granite, exc cond, flowers, leaves "Knobeloch / Karl C. / 1835-1915 / Father / At rest / Clara D. / 1845-1930 / Mother / At rest" CR: Karl Charles, d. November 15, 1915. Clara Dorthea Knobloch, d. November 23, 1930, 85y 10m 8da$nhg$,
        $nhg$Knobeloch / Karl C. / 1835-1915 / Father / At rest / Clara D. / 1845-1930 / Mother / At rest$nhg$,
        ARRAY[1835, 1845, 1915, 1930]::integer[],
        $json${"heading":"KNOBELOCH/KNOBLOCH (13C, 11, c) upright, gray granite, exc cond, flowers, leaves","descriptor":"upright, gray granite, exc cond, flowers, leaves"}$json$::jsonb
      ),
      (
        12, 41, 'EHRHARDT', ARRAY['EHRHARDT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$EHRHARDT (13C, 12, c) upright, gray granite, exc cond, oak leaves, acorns "J. V. Ehrhardt/ 1860-1909. / Anna M. Ehrhardt / 1867-1943. / Ehrhardt"$nhg$,
        $nhg$J. V. Ehrhardt/ 1860-1909. / Anna M. Ehrhardt / 1867-1943. / Ehrhardt$nhg$,
        ARRAY[1860, 1867, 1909, 1943]::integer[],
        $json${"heading":"EHRHARDT (13C, 12, c) upright, gray granite, exc cond, oak leaves, acorns","descriptor":"upright, gray granite, exc cond, oak leaves, acorns"}$json$::jsonb
      ),
      (
        14, 50, 'BRANT', ARRAY['BRANT']::text[], 'single', 'upright', 'granite', 'excellent',
        $nhg$BRANT (13C, 14, s) upright, gray granite, exc cond, child's head, shoulders, arms with cover in bassinette, angel on top "Baby Brant / Infant son of / Clifford & Jacqueline / Brant / January 20, 1949" CR: Buried January 21, 1y$nhg$,
        $nhg$Baby Brant / Infant son of / Clifford & Jacqueline / Brant / January 20, 1949$nhg$,
        ARRAY[1949]::integer[],
        $json${"heading":"BRANT (13C, 14, s) upright, gray granite, exc cond, child's head, shoulders, arms with cover in bassinette, angel on top","descriptor":"upright, gray granite, exc cond, child's head, shoulders, arms with cover in bassinette, angel on top"}$json$::jsonb
      ),
      (
        16, 60, 'BRANT', ARRAY['BRANT']::text[], 'couple', 'upright', 'granite', 'excellent',
        $nhg$BRANT (13C, 16, c) upright, gray granite, exc cond, flowers, leaves "Brant/ Herbert G. / 1908-1943 / Helen S. / 1915-1998" Three loose mementos were observed on base on both reading days: 2 kneeling children on book with flowers, terracotta praying angel, basket of flowers. CR: Middle name George, d. December 6, 1943$nhg$,
        $nhg$Brant/ Herbert G. / 1908-1943 / Helen S. / 1915-1998$nhg$,
        ARRAY[1908, 1915, 1943, 1998]::integer[],
        $json${"heading":"BRANT (13C, 16, c) upright, gray granite, exc cond, flowers, leaves","descriptor":"upright, gray granite, exc cond, flowers, leaves"}$json$::jsonb
      )
  ) AS corrections(parsed_position_number, source_line_end, name_text, surnames, parsed_marker_scope, marker_type_text, material_text, condition_text, raw_text, inscription_text, parsed_years, source_entry)
  WHERE entry.source_page_number = 213
    AND entry.parsed_section_name = 'C'
    AND entry.parsed_row_number = 13
    AND entry.parsed_position_number = corrections.parsed_position_number
  RETURNING entry.id
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING updated_entries
  WHERE fact.entry_id = updated_entries.id
    AND fact.source_code = 'CR'
  RETURNING fact.id
)
SELECT count(*) FROM removed_facts;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT entry.id, fact.source_code, fact.source_label, fact.fact_type, fact.fact_value, fact.fact_date, fact.raw_text, fact.confidence
FROM north_hills_ocr_entries entry
JOIN (
  VALUES
    (8, 'CR', 'Church Records', 'note', 'Sept. 22, 1906 - Sept. 14, 1992', NULL::date, 'CR: Sept. 22, 1906 - Sept. 14, 1992', 'review'),
    (9, 'CR', 'Church Records', 'note', 'Arthur Julius. Isabelle, Glenn-Kildoo Funeral Home', NULL::date, 'CR: Arthur Julius. Isabelle, Glenn-Kildoo Funeral Home', 'review'),
    (10, 'CR', 'Church Records', 'death_date', 'April 2, 1932', DATE '1932-04-02', 'CR: Middle name Ruth, d. April 2, 1932, 5y 6m 9da', 'high'),
    (10, 'CR', 'Church Records', 'note', 'Middle name Ruth, d. April 2, 1932, 5y 6m 9da', NULL::date, 'CR: Middle name Ruth, d. April 2, 1932, 5y 6m 9da', 'review'),
    (11, 'CR', 'Church Records', 'death_date', 'November 15, 1915', DATE '1915-11-15', 'CR: Karl Charles, d. November 15, 1915. Clara Dorthea Knobloch, d. November 23, 1930, 85y 10m 8da', 'high'),
    (11, 'CR', 'Church Records', 'death_date', 'November 23, 1930', DATE '1930-11-23', 'CR: Karl Charles, d. November 15, 1915. Clara Dorthea Knobloch, d. November 23, 1930, 85y 10m 8da', 'high'),
    (11, 'CR', 'Church Records', 'note', 'Karl Charles, d. November 15, 1915. Clara Dorthea Knobloch, d. November 23, 1930, 85y 10m 8da', NULL::date, 'CR: Karl Charles, d. November 15, 1915. Clara Dorthea Knobloch, d. November 23, 1930, 85y 10m 8da', 'review'),
    (14, 'CR', 'Church Records', 'note', 'Buried January 21, 1y', NULL::date, 'CR: Buried January 21, 1y', 'review'),
    (16, 'CR', 'Church Records', 'death_date', 'December 6, 1943', DATE '1943-12-06', 'CR: Middle name George, d. December 6, 1943', 'high'),
    (16, 'CR', 'Church Records', 'note', 'Middle name George, d. December 6, 1943', NULL::date, 'CR: Middle name George, d. December 6, 1943', 'review')
) AS fact(parsed_position_number, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
  ON fact.parsed_position_number = entry.parsed_position_number
WHERE entry.source_page_number = 213
  AND entry.parsed_section_name = 'C'
  AND entry.parsed_row_number = 13
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE
SET
  fact_date = EXCLUDED.fact_date,
  raw_text = EXCLUDED.raw_text,
  confidence = EXCLUDED.confidence,
  updated_at = now();

--rollback DELETE FROM north_hills_ocr_source_facts WHERE entry_id IN (SELECT id FROM north_hills_ocr_entries WHERE source_page_number = 213 AND parsed_section_name = 'C' AND parsed_row_number = 13 AND parsed_position_number IN (8, 9, 10, 11, 14, 16)) AND source_code = 'CR';
--rollback DELETE FROM audit_events WHERE target_table IN ('north_hills_ocr_entries', 'north_hills_ocr_source_facts');
