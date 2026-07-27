--liquibase formatted sql

--changeset cemeterymapping:263-headstone-marker-scopes splitStatements:false
CREATE TABLE marker_scope_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO marker_scope_types (id, code, label, description, sort_order)
VALUES
  ('de1b835e-e45b-46fc-86f1-f4ccf88c29c1', 'single', 'Single', 'A marker classified by its source as serving one burial or gravesite.', 10),
  ('ab35a3c0-bfa5-4932-9045-ab0bdf125a04', 'couple', 'Couple', 'A marker classified by its source as serving two people or gravesites.', 20),
  ('17aa904b-6146-428c-89ff-ce8f08078190', 'monolith', 'Monolith', 'A shared plot or family marker classified as a monolith by its source; physical form is recorded separately as marker type.', 30),
  ('705acbc6-b9de-47eb-b7a8-18dca07a223d', 'unknown', 'Unknown', 'Marker scope has not been classified or is not supported by reviewed source evidence.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE headstones
  ADD COLUMN marker_scope_type_id uuid NOT NULL DEFAULT '705acbc6-b9de-47eb-b7a8-18dca07a223d' REFERENCES marker_scope_types(id);

UPDATE headstones
SET marker_scope_type_id = '705acbc6-b9de-47eb-b7a8-18dca07a223d';

WITH explicit_linked_scope AS (
  SELECT
    links.headstone_uuid,
    min(entries.parsed_marker_scope) AS scope_code
  FROM north_hills_ocr_entry_headstone_links links
  JOIN north_hills_ocr_entries entries
    ON entries.id = links.entry_id
  WHERE links.status = 'linked'
    AND entries.parsed_marker_scope IN ('single', 'couple', 'monolith')
  GROUP BY links.headstone_uuid
  HAVING count(DISTINCT entries.parsed_marker_scope) = 1
)
UPDATE headstones
SET marker_scope_type_id = marker_scope_types.id
FROM explicit_linked_scope
JOIN marker_scope_types
  ON marker_scope_types.code = explicit_linked_scope.scope_code
WHERE headstones.id = explicit_linked_scope.headstone_uuid;

UPDATE headstones
SET
  marker_scope_type_id = (
    SELECT id FROM marker_scope_types WHERE code = 'monolith'
  ),
  marker_type_id = (
    SELECT id FROM marker_types WHERE code = 'upright_headstone'
  ),
  source_properties = COALESCE(source_properties, '{}'::jsonb)
    || jsonb_build_object(
      'MarkerScopeClassification',
      jsonb_build_object(
        'scope', 'monolith',
        'physicalMarkerType', 'upright_headstone',
        'source', 'North Hills Genealogists cemetery reading (8C, 4, monolith)',
        'classifiedAt', '2026-07-27'
      )
    ),
  updated_at = now()
WHERE headstone_id = 'TLC-HS-0284'
  AND deleted_at IS NULL;

CREATE INDEX headstones_marker_scope_type_id_idx
  ON headstones (marker_scope_type_id);

DROP TRIGGER IF EXISTS touch_marker_scope_types_updated_at ON marker_scope_types;
CREATE TRIGGER touch_marker_scope_types_updated_at
  BEFORE UPDATE ON marker_scope_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_marker_scope_types_changes ON marker_scope_types;
CREATE TRIGGER audit_marker_scope_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON marker_scope_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_marker_scope_types_changes ON marker_scope_types;
--rollback DROP TRIGGER IF EXISTS touch_marker_scope_types_updated_at ON marker_scope_types;
--rollback DROP INDEX IF EXISTS headstones_marker_scope_type_id_idx;
--rollback ALTER TABLE headstones DROP COLUMN IF EXISTS marker_scope_type_id;
--rollback DROP TABLE IF EXISTS marker_scope_types;
