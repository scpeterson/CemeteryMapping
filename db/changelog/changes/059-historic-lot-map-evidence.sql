--liquibase formatted sql

--changeset cemeterymapping:059-historic-lot-map-evidence splitStatements:false
CREATE TABLE historic_lot_map_gravesite_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  gravesite_uuid uuid NOT NULL REFERENCES gravesites(id) ON DELETE CASCADE,
  observed_gravesite_label varchar(100) NOT NULL,
  lot_uuid uuid REFERENCES lots(id) ON DELETE SET NULL,
  source_name varchar(250) NOT NULL,
  source_path varchar(1000),
  source_detail varchar(500) NOT NULL,
  section_name varchar(50) NOT NULL,
  lot_identifier varchar(50),
  relationship_type varchar(50) NOT NULL DEFAULT 'lot',
  passage_between_lot_identifiers text[] NOT NULL DEFAULT '{}',
  confidence varchar(50) NOT NULL DEFAULT 'review',
  status varchar(50) NOT NULL DEFAULT 'staged',
  notes varchar(4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT historic_lot_map_gravesite_evidence_relationship_check CHECK (
    relationship_type IN ('lot', 'passageway_between_lots', 'adjacent_to_lot', 'unknown')
  ),
  CONSTRAINT historic_lot_map_gravesite_evidence_confidence_check CHECK (confidence IN ('high', 'medium', 'low', 'review')),
  CONSTRAINT historic_lot_map_gravesite_evidence_status_check CHECK (status IN ('staged', 'reviewed', 'promoted', 'rejected')),
  CONSTRAINT historic_lot_map_gravesite_evidence_unique UNIQUE (
    gravesite_uuid,
    observed_gravesite_label,
    source_name,
    source_detail
  )
);

CREATE INDEX historic_lot_map_gravesite_evidence_lookup_idx
  ON historic_lot_map_gravesite_evidence (cemetery_id, section_name, lot_identifier, relationship_type, status);

CREATE INDEX historic_lot_map_gravesite_evidence_lot_idx
  ON historic_lot_map_gravesite_evidence (lot_uuid)
  WHERE lot_uuid IS NOT NULL;

CREATE TRIGGER touch_historic_lot_map_gravesite_evidence_updated_at
  BEFORE UPDATE ON historic_lot_map_gravesite_evidence
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_historic_lot_map_gravesite_evidence_changes
  AFTER INSERT OR UPDATE OR DELETE ON historic_lot_map_gravesite_evidence
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

WITH source_observations(gravesite_label, fallback_gravesite_label, lot_identifier, relationship_type, passage_between_lot_identifiers, source_name, source_path, source_detail, notes) AS (
  VALUES
    ('C-0168', NULL, '70', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 70 reviewed scan observation', 'Historic scanned lot maps appear to place C-0168 with C-0167A, C-0167B, C-0166A, and C-0166B in Section C lot 70. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0167A', NULL, '70', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 70 reviewed scan observation', 'Historic scanned lot maps appear to place C-0167A with C-0168, C-0167B, C-0166A, and C-0166B in Section C lot 70. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0167B', NULL, '70', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 70 reviewed scan observation', 'Historic scanned lot maps appear to place C-0167B with C-0168, C-0167A, C-0166A, and C-0166B in Section C lot 70. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0166A', 'C-0166', '70', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 70 reviewed scan observation', 'Historic scanned lot maps appear to place C-0166A with C-0168, C-0167A, C-0167B, and C-0166B in Section C lot 70. The original C-0166 gravesite was created from the Geo-locations spreadsheet. Ruth and Charles Soergel died after NHG was published in 1997, so NHG has no entry and likely no headstone existed there at publication. A later field photo shows one shared headstone for both gravesites, so C-0166 was split into C-0166A and C-0166B. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0166B', 'C-0166', '70', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 70 reviewed scan observation', 'Historic scanned lot maps appear to place C-0166B with C-0168, C-0167A, C-0167B, and C-0166A in Section C lot 70. The original C-0166 gravesite was created from the Geo-locations spreadsheet. Ruth and Charles Soergel died after NHG was published in 1997, so NHG has no entry and likely no headstone existed there at publication. A later field photo shows one shared headstone for both gravesites, so C-0166 was split into C-0166A and C-0166B. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0171B', NULL, '51', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 51 reviewed scan observation', 'Historic scanned lot maps appear to place C-0171B with C-0171A, C-0170, and C-0169 in Section C lot 51. One lot 51 gravesite may remain unaccounted for. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0171A', NULL, '51', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 51 reviewed scan observation', 'Historic scanned lot maps appear to place C-0171A with C-0171B, C-0170, and C-0169 in Section C lot 51. One lot 51 gravesite may remain unaccounted for. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0170', NULL, '51', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 51 reviewed scan observation', 'Historic scanned lot maps appear to place C-0170 with C-0171B, C-0171A, and C-0169 in Section C lot 51. One lot 51 gravesite may remain unaccounted for. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0169', NULL, '51', 'lot', ARRAY[]::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C lot 51 reviewed scan observation', 'Historic scanned lot maps appear to place C-0169 with C-0171B, C-0171A, and C-0170 in Section C lot 51. One lot 51 gravesite may remain unaccounted for. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0172A', NULL, NULL, 'passageway_between_lots', ARRAY['29', '51']::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C passageway between lots 29 and 51 reviewed scan observation', 'Historic scanned lot maps appear to place C-0172A in the Section C passageway between lots 29 and 51, not in lot 51. The C-0172 split comes from a shared couple headstone: James H. Simpson died in 1995 and appears in NHG, while Ruth F. Simpson died in 2011 after NHG publication and uses the same marker from a separate gravesite. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.'),
    ('C-0172B', NULL, NULL, 'passageway_between_lots', ARRAY['29', '51']::text[], 'TIFF2042-01.png / TIFF2043-01.png', '/Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2042-01.png; /Users/scottpeterson/Library/CloudStorage/Dropbox/CemeteryDataManagement/TIFF2043-01.png', 'Section C passageway between lots 29 and 51 reviewed scan observation', 'Historic scanned lot maps appear to place C-0172B in the Section C passageway between lots 29 and 51, not in lot 51. The C-0172 split comes from a shared couple headstone: James H. Simpson died in 1995 and appears in NHG, while Ruth F. Simpson died in 2011 after NHG publication and uses the same marker from a separate gravesite. Non-survey-grade evidence; north and south appear reversed between the two scans, so review orientation before promotion.')
),
matched_gravesites AS (
  SELECT
    gravesites.id AS gravesite_uuid,
    gravesites.cemetery_id,
    observations.*
  FROM source_observations observations
  JOIN LATERAL (
    SELECT matched.*
    FROM gravesites matched
    WHERE (
      matched.gravesite_id IN (observations.gravesite_label, observations.fallback_gravesite_label)
      OR concat_ws('-', matched.section_id, matched.grave_id) IN (
        observations.gravesite_label,
        observations.fallback_gravesite_label
      )
    )
      AND matched.deleted_at IS NULL
      AND upper(COALESCE(matched.section_id, '')) = 'C'
    ORDER BY
      CASE
        WHEN matched.gravesite_id = observations.gravesite_label
          OR concat_ws('-', matched.section_id, matched.grave_id) = observations.gravesite_label
        THEN 0
        ELSE 1
      END
    LIMIT 1
  ) gravesites ON true
  WHERE upper(COALESCE(gravesites.section_id, '')) = 'C'
),
matched_lots AS (
  SELECT
    matched_gravesites.*,
    lots.id AS lot_uuid
  FROM matched_gravesites
  LEFT JOIN lots
    ON lots.cemetery_id = matched_gravesites.cemetery_id
   AND upper(COALESCE(lots.section_id, '')) = 'C'
   AND lots.lot_id = matched_gravesites.lot_identifier
   AND lots.deleted_at IS NULL
)
INSERT INTO historic_lot_map_gravesite_evidence (
  cemetery_id,
  gravesite_uuid,
  observed_gravesite_label,
  lot_uuid,
  source_name,
  source_path,
  source_detail,
  section_name,
  lot_identifier,
  relationship_type,
  passage_between_lot_identifiers,
  confidence,
  status,
  notes
)
SELECT
  cemetery_id,
  gravesite_uuid,
  gravesite_label,
  CASE WHEN relationship_type = 'lot' THEN lot_uuid ELSE NULL END,
  source_name,
  source_path,
  source_detail,
  'C',
  lot_identifier,
  relationship_type,
  passage_between_lot_identifiers,
  'review',
  'staged',
  notes
FROM matched_lots
ON CONFLICT (gravesite_uuid, observed_gravesite_label, source_name, source_detail) DO UPDATE SET
  lot_uuid = EXCLUDED.lot_uuid,
  lot_identifier = EXCLUDED.lot_identifier,
  relationship_type = EXCLUDED.relationship_type,
  passage_between_lot_identifiers = EXCLUDED.passage_between_lot_identifiers,
  confidence = EXCLUDED.confidence,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = now();

--rollback DROP TRIGGER IF EXISTS audit_historic_lot_map_gravesite_evidence_changes ON historic_lot_map_gravesite_evidence;
--rollback DROP TRIGGER IF EXISTS touch_historic_lot_map_gravesite_evidence_updated_at ON historic_lot_map_gravesite_evidence;
--rollback DROP TABLE IF EXISTS historic_lot_map_gravesite_evidence;
