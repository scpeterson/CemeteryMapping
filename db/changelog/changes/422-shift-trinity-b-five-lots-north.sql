--liquibase formatted sql

--changeset cemeterymapping:422-shift-trinity-b-five-lots-north splitStatements:false
DO $shift$
DECLARE
  target_ids uuid[];
  cemetery uuid;
  center_point geometry;
  north_delta double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lots WHERE facility_id='1' AND section_id='B'
    AND block_id IS NULL AND deleted_at IS NULL) THEN RETURN; END IF;
  SELECT array_agg(id),ST_Centroid(ST_Collect(geometry)) INTO target_ids,center_point
    FROM lots WHERE facility_id='1' AND section_id='B' AND block_id IS NULL
      AND deleted_at IS NULL AND lot_id IN ('21','15','4','14','5');
  PERFORM assert_migration_prerequisite(cardinality(target_ids)=5,
    'Migration 422 requires all five active Section B lots');
  SELECT cemetery_id INTO cemetery FROM lots WHERE id=target_ids[1];
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM lots WHERE id=ANY(target_ids)
    AND (cemetery_id IS DISTINCT FROM cemetery OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry))),
    'Migration 422 requires valid lots in one cemetery');
  -- One shared latitude translation preserves footprints and all longitudes.
  north_delta := ST_Y(ST_Project(center_point::geography,0.3048,0)::geometry)-ST_Y(center_point);
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots target JOIN lots other ON other.cemetery_id=cemetery
      AND other.deleted_at IS NULL AND NOT (other.id=ANY(target_ids))
    WHERE target.id=ANY(target_ids) AND ST_Area(ST_Intersection(other.geometry,
      ST_Translate(target.geometry,0,north_delta)))>1e-16),
    'Migration 422 shifted group must not overlap other active lots');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason','Migration 422: translate B-21, B-15, B-4, B-14, B-5 together one foot north.',true);
  UPDATE lots SET geometry=ST_Translate(geometry,0,north_delta)::geometry(MultiPolygon,4326),
    geometry_source='Migration 422: group translation one foot north.',
    geometry_notes='B-21, B-15, B-4, B-14, B-5 shifted together; dimensions, relative positions, and shared edges preserved.',
    updated_at=now()
  WHERE id=ANY(target_ids);
END
$shift$;

--rollback empty
