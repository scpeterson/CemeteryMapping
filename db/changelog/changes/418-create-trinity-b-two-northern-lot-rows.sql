--liquibase formatted sql

--changeset cemeterymapping:418-create-trinity-b-two-northern-lot-rows splitStatements:false
DO $lots$
DECLARE
  anchor lots%ROWTYPE;
  lot_width double precision;
  lot_height double precision;
  gap_latitude double precision;
  north_edge geometry;
BEGIN
  -- Synthetic environments without Trinity Section B have no source to extend.
  IF NOT EXISTS (SELECT 1 FROM lots WHERE facility_id = '1' AND section_id = 'B'
    AND block_id IS NULL AND deleted_at IS NULL) THEN RETURN; END IF;

  SELECT * INTO STRICT anchor FROM lots WHERE facility_id = '1' AND section_id = 'B'
    AND lot_id = '4' AND block_id IS NULL AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(
    ST_IsValid(anchor.geometry) AND NOT ST_IsEmpty(anchor.geometry)
      AND ST_Equals(anchor.geometry, ST_Envelope(anchor.geometry)),
    'Migration 418 requires the established rectangular B-4 footprint');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id = '1' AND section_id = 'B' AND block_id IS NULL
      AND lot_id IN ('3','16','20','22','2','17','19','23')),
    'Migration 418 lot identifiers must be unused, including retired lots');

  lot_width := ST_XMax(Box2D(anchor.geometry)) - ST_XMin(Box2D(anchor.geometry));
  lot_height := ST_YMax(Box2D(anchor.geometry)) - ST_YMin(Box2D(anchor.geometry));
  north_edge := ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(anchor.geometry)),
    ST_YMax(Box2D(anchor.geometry))), 4326);
  -- Six feet of clear space, measured due north from B-4's northern edge.
  gap_latitude := ST_Y(ST_Project(north_edge::geography, 1.8288, 0)::geometry) - ST_Y(north_edge);

  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots existing CROSS JOIN generate_series(0, 3) col
      CROSS JOIN generate_series(0, 1) row_number
    WHERE existing.cemetery_id = anchor.cemetery_id AND existing.deleted_at IS NULL
      AND ST_Area(ST_Intersection(existing.geometry, ST_Translate(anchor.geometry,
        -col * lot_width, (row_number + 1) * lot_height + gap_latitude))) > 1e-16),
    'Migration 418 proposed rows must not overlap existing active lots');

  PERFORM set_config('app.audit.source', 'migration', true);
  PERFORM set_config('app.audit.reason', 'Migration 418: add two four-lot Section B rows with a six-foot gap north of B-4.', true);
  INSERT INTO lots (cemetery_id, section_uuid, name, facility_id, section_id, block_id,
    lot_id, width_feet, length_feet, geometry, burial_use_status, geometry_type,
    geometry_source, geometry_confidence, geometry_notes)
  SELECT anchor.cemetery_id, anchor.section_uuid, 'B-' || grid.lot_id,
    anchor.facility_id, anchor.section_id, NULL, grid.lot_id,
    anchor.width_feet, anchor.length_feet,
    ST_Translate(anchor.geometry, -grid.col * lot_width,
      (grid.row_number + 1) * lot_height + gap_latitude)::geometry(MultiPolygon,4326),
    'standard', 'operational', 'Migration 418: translated B-4 footprint.', 'estimated',
    'Reviewed placement: south row east-to-west B-3, B-16, B-20, B-22; north row B-2, B-17, B-19, B-23. Six-foot gap north of B-4; adjacent new lots share edges.'
  FROM (VALUES ('3',0,0),('16',1,0),('20',2,0),('22',3,0),
    ('2',0,1),('17',1,1),('19',2,1),('23',3,1)) AS grid(lot_id,col,row_number);
END
$lots$;

--rollback empty
