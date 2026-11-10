// The same candidate relation drives the batch total and paged details. Keep
// LIKE patterns and page-prefix matching unchanged: both are source evidence.
export function candidateMatchCtes(entryRelation) {
  return `candidate_entries AS MATERIALIZED (SELECT * FROM ${entryRelation}),
    candidate_burials AS MATERIALIZED (
      SELECT b.id, b.gravesite_uuid, g.cemetery_id,
        lower(coalesce(b.full_name, b.last_name, '')) AS search_name, b.notes
      FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid
      WHERE b.deleted_at IS NULL AND g.deleted_at IS NULL
        AND g.cemetery_id IN (SELECT cemetery_id FROM candidate_entries)
    ), entry_surnames AS MATERIALIZED (
      SELECT DISTINCT e.id, e.cemetery_id, lower(s.value) AS pattern
      FROM candidate_entries e CROSS JOIN LATERAL unnest(e.surnames) s(value)
    ), surname_patterns AS MATERIALIZED (
      SELECT DISTINCT cemetery_id, pattern FROM entry_surnames
    ), surname_burials AS MATERIALIZED (
      SELECT p.cemetery_id, p.pattern, b.id
      FROM surname_patterns p JOIN candidate_burials b ON b.cemetery_id=p.cemetery_id
        AND b.search_name LIKE '%' || p.pattern || '%'
    ), page_burials AS MATERIALIZED (
      SELECT p.cemetery_id, p.source_page_number, b.id
      FROM (SELECT DISTINCT cemetery_id, source_page_number FROM candidate_entries
        WHERE source_page_number IS NOT NULL) p
      JOIN candidate_burials b ON b.cemetery_id=p.cemetery_id
        AND b.notes ILIKE ('%' || 'North Hills Genealogists page: ' || p.source_page_number::text || '%')
    ), unknown_markers AS MATERIALIZED (
      SELECT e.id AS entry_id, h.id AS marker_id, h.gravesite_uuid
      FROM candidate_entries e JOIN headstones h
        ON upper(h.source_properties->>'NhgSection')=upper(e.parsed_section_name)
        AND h.source_properties->>'NhgRow'=e.parsed_row_number::text
        AND h.source_properties->>'NhgPage' IN ((e.source_page_number-1)::text,
          e.source_page_number::text,(e.source_page_number+1)::text)
      WHERE upper(trim(coalesce(e.name_text,'')))='UNKNOWN'
        AND e.parsed_section_name IS NOT NULL AND e.parsed_row_number IS NOT NULL
        AND e.source_page_number IS NOT NULL AND h.deleted_at IS NULL
    ), unknown_graves AS (
      SELECT entry_id, gravesite_uuid FROM unknown_markers
      UNION
      SELECT m.entry_id, hg.gravesite_uuid FROM unknown_markers m
      JOIN headstone_gravesites hg ON hg.headstone_uuid=m.marker_id AND hg.deleted_at IS NULL
    ), location_burials AS (
      -- Imported illegible burials can have a complete NHG location without a
      -- page number. Require all three coordinates; never infer from row alone.
      SELECT e.id AS entry_id, b.id AS burial_id
      FROM candidate_entries e JOIN candidate_burials b ON b.cemetery_id=e.cemetery_id
        AND upper(trim(substring(b.notes from 'North Hills Genealogists section: ([^.]+)[.]')))=upper(trim(e.parsed_section_name))
        AND trim(substring(b.notes from 'North Hills Genealogists row: ([^.]+)[.]'))=e.parsed_row_number::text
        AND trim(substring(b.notes from 'North Hills Genealogists site: ([^.]+)[.]'))=e.parsed_position_number::text
      WHERE upper(trim(coalesce(e.name_text,'')))='UNKNOWN'
        AND e.parsed_section_name IS NOT NULL AND trim(e.parsed_section_name)<>''
        AND e.parsed_row_number IS NOT NULL AND e.parsed_position_number IS NOT NULL
    ), matching_burials AS MATERIALIZED (
      SELECT e.id AS entry_id, b.id AS burial_id FROM entry_surnames e
      JOIN surname_burials b ON b.cemetery_id=e.cemetery_id AND b.pattern=e.pattern
      UNION
      SELECT e.id, b.id FROM candidate_entries e JOIN page_burials b
        ON b.cemetery_id=e.cemetery_id AND b.source_page_number=e.source_page_number
      UNION
      SELECT u.entry_id, b.id FROM unknown_graves u JOIN candidate_burials b
        ON b.gravesite_uuid=u.gravesite_uuid
      JOIN candidate_entries e ON e.id=u.entry_id AND e.cemetery_id=b.cemetery_id
      UNION
      SELECT entry_id, burial_id FROM location_burials
    )`;
}
