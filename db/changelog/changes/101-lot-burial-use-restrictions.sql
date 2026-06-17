--liquibase formatted sql

--changeset cemeterymapping:101-lot-burial-use-restrictions splitStatements:false
ALTER TABLE lots
  ADD COLUMN burial_use_status varchar(40) NOT NULL DEFAULT 'standard',
  ADD COLUMN burial_use_notes text,
  ADD CONSTRAINT lots_burial_use_status_check CHECK (burial_use_status IN ('standard', 'non_burial', 'partially_restricted'));

CREATE TABLE lot_restricted_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_uuid uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  restriction_type varchar(40) NOT NULL DEFAULT 'non_burial',
  name varchar(255) NOT NULL,
  notes text,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(1000),
  CONSTRAINT lot_restricted_areas_restriction_type_check CHECK (restriction_type IN ('non_burial', 'no_gravesites_or_markers'))
);

CREATE INDEX lot_restricted_areas_lot_uuid_idx ON lot_restricted_areas (lot_uuid);
CREATE INDEX lot_restricted_areas_geometry_gix ON lot_restricted_areas USING gist (geometry);

DROP TRIGGER IF EXISTS audit_lot_restricted_areas_changes ON lot_restricted_areas;
CREATE TRIGGER audit_lot_restricted_areas_changes
  AFTER INSERT OR UPDATE OR DELETE ON lot_restricted_areas
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

UPDATE lots
SET
  burial_use_status = 'non_burial',
  burial_use_notes = 'Lot exists in the cemetery lot grid, but it cannot contain gravesites or markers.',
  updated_at = now()
WHERE lots.deleted_at IS NULL
  AND lots.block_id IS NULL
  AND (
    (upper(COALESCE(lots.section_id, '')) = 'C' AND lots.lot_id IN ('84', '85', '90', '95', '100'))
    OR (upper(COALESCE(lots.section_id, '')) = 'A' AND lots.lot_id = '61')
  );

UPDATE lots
SET
  burial_use_status = 'partially_restricted',
  burial_use_notes = 'Southern 2/5 of this lot cannot contain gravesites or markers.',
  updated_at = now()
WHERE lots.deleted_at IS NULL
  AND lots.block_id IS NULL
  AND upper(COALESCE(lots.section_id, '')) = 'A'
  AND lots.lot_id = '62';

WITH a_62 AS (
  SELECT
    lots.id AS lot_uuid,
    ST_XMin(Box2D(lots.geometry)) AS west_longitude,
    ST_XMax(Box2D(lots.geometry)) AS east_longitude,
    ST_YMin(Box2D(lots.geometry)) AS south_latitude,
    ST_YMin(Box2D(lots.geometry)) + ((ST_YMax(Box2D(lots.geometry)) - ST_YMin(Box2D(lots.geometry))) * 0.4) AS north_latitude
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND lots.block_id IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'A'
    AND lots.lot_id = '62'
),
restricted_area AS (
  SELECT
    a_62.lot_uuid,
    ST_Multi(
      ST_MakeEnvelope(
        a_62.west_longitude,
        a_62.south_latitude,
        a_62.east_longitude,
        a_62.north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM a_62
)
INSERT INTO lot_restricted_areas (
  lot_uuid,
  restriction_type,
  name,
  notes,
  geometry,
  updated_at
)
SELECT
  restricted_area.lot_uuid,
  'no_gravesites_or_markers',
  'A-62 southern 2/5',
  'Southern two possible gravesite positions cannot contain gravesites or markers.',
  restricted_area.geometry,
  now()
FROM restricted_area;

--rollback DROP TRIGGER IF EXISTS audit_lot_restricted_areas_changes ON lot_restricted_areas;
--rollback DROP INDEX IF EXISTS lot_restricted_areas_geometry_gix;
--rollback DROP INDEX IF EXISTS lot_restricted_areas_lot_uuid_idx;
--rollback DROP TABLE IF EXISTS lot_restricted_areas;
--rollback ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_burial_use_status_check, DROP COLUMN IF EXISTS burial_use_notes, DROP COLUMN IF EXISTS burial_use_status;
