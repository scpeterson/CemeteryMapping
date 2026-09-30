--liquibase formatted sql

--changeset cemeterymapping:421-shift-trinity-b-eight-lots-west-and-north splitStatements:false
DO $shift$
DECLARE
  target_ids uuid[];
  cemetery uuid;
  center_point geometry;
  west_delta double precision;
  north_delta double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lots WHERE facility_id='1' AND section_id='B'
    AND block_id IS NULL AND deleted_at IS NULL) THEN RETURN; END IF;
  SELECT array_agg(id),ST_Centroid(ST_Collect(geometry)) INTO target_ids,center_point
    FROM lots WHERE facility_id='1' AND section_id='B' AND block_id IS NULL
      AND deleted_at IS NULL AND lot_id IN ('23','19','17','2','22','20','16','3');
  PERFORM assert_migration_prerequisite(cardinality(target_ids)=8,
    'Migration 421 requires all eight active Section B lots');
  SELECT cemetery_id INTO cemetery FROM lots WHERE id=target_ids[1];
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM lots WHERE id=ANY(target_ids)
    AND (cemetery_id IS DISTINCT FROM cemetery OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry))),
    'Migration 421 requires valid lots in one cemetery');
  -- One shared longitude/latitude translation preserves all footprints and edges.
  west_delta := ST_X(ST_Project(center_point::geography,0.4572,radians(270))::geometry)-ST_X(center_point);
  north_delta := ST_Y(ST_Project(center_point::geography,0.3048,0)::geometry)-ST_Y(center_point);
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots target JOIN lots other ON other.cemetery_id=cemetery
      AND other.deleted_at IS NULL AND NOT (other.id=ANY(target_ids))
    WHERE target.id=ANY(target_ids) AND ST_Area(ST_Intersection(other.geometry,
      ST_Translate(target.geometry,west_delta,north_delta)))>1e-16),
    'Migration 421 shifted group must not overlap other active lots');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason','Migration 421: translate eight Section B lots together 1.5 feet west and one foot north.',true);
  UPDATE lots SET geometry=ST_Translate(geometry,west_delta,north_delta)::geometry(MultiPolygon,4326),
    geometry_source='Migration 421: group translation 1.5 feet west and one foot north.',
    geometry_notes='B-23, B-19, B-17, B-2, B-22, B-20, B-16, B-3 shifted together; dimensions, relative positions, and shared edges preserved.',
    updated_at=now()
  WHERE id=ANY(target_ids);
END
$shift$;

--rollback empty
