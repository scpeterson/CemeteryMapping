--liquibase formatted sql

--changeset cemeterymapping:495-shift-section-a-eighteen-lots-north splitStatements:false
DO $shift$
DECLARE
  target_ids uuid[];
  target_count integer;
  cemetery uuid;
  center_point geometry;
  marker_geometry geometry;
  anchor_geometry geometry;
  north_delta double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lots WHERE facility_id='1' AND section_id='A'
    AND block_id IS NULL AND deleted_at IS NULL) THEN RETURN; END IF;
  SELECT array_agg(id),count(DISTINCT lot_id) INTO target_ids,target_count
    FROM lots WHERE facility_id='1' AND section_id='A' AND block_id IS NULL
      AND deleted_at IS NULL
      AND lot_id IN ('1','2','3','4','5','6','7','8','9','30','31','32','33','34','35','36','37','38');
  PERFORM assert_migration_prerequisite(cardinality(target_ids)=18 AND target_count=18,
    'Migration 495 requires all eighteen active Section A lots');
  SELECT cemetery_id INTO cemetery FROM lots WHERE id=target_ids[1];
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM lots WHERE id=ANY(target_ids)
    AND (cemetery_id IS DISTINCT FROM cemetery OR geometry IS NULL
      OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry))),
    'Migration 495 requires valid lots in one cemetery');
  SELECT h.geometry INTO marker_geometry FROM headstones h
    JOIN gravesites g ON g.id=h.gravesite_uuid AND g.cemetery_id=cemetery AND g.deleted_at IS NULL
    WHERE h.headstone_id='TLC-HS-0053' AND h.deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(marker_geometry IS NOT NULL
    AND ST_IsValid(marker_geometry) AND NOT ST_IsEmpty(marker_geometry),
    'Migration 495 requires the active TLC-HS-0053 marker in the same cemetery');
  SELECT ST_Centroid(ST_Collect(geometry)) INTO center_point FROM lots WHERE id=ANY(target_ids);
  -- One shared latitude offset preserves every longitude, footprint and shared edge.
  north_delta := ST_Y(ST_Project(center_point::geography,0.3048,0)::geometry)-ST_Y(center_point);
  SELECT ST_Translate(geometry,0,north_delta) INTO anchor_geometry
    FROM lots WHERE id=ANY(target_ids) AND lot_id='34';
  PERFORM assert_migration_prerequisite(ST_ContainsProperly(anchor_geometry,marker_geometry),
    'Migration 495 must place TLC-HS-0053 strictly inside A-34');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots moving JOIN lots other ON other.cemetery_id=cemetery
      AND other.deleted_at IS NULL AND NOT (other.id=ANY(target_ids))
      AND ST_Intersects(other.geometry,ST_Translate(moving.geometry,0,north_delta))
    WHERE moving.id=ANY(target_ids) AND ST_Area(ST_Intersection(other.geometry,
      ST_Translate(moving.geometry,0,north_delta))::geography)>0.001),
    'Migration 495 shifted group must not overlap other active lots');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots moving JOIN cemeteries c ON c.id=moving.cemetery_id
    WHERE moving.id=ANY(target_ids) AND NOT ST_Covers(c.geometry,
      ST_Translate(moving.geometry,0,north_delta))),
    'Migration 495 shifted group must remain inside the cemetery');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason',
    'Migration 495: translate A-1 through A-9 and A-30 through A-38 together one foot north to contain TLC-HS-0053 in A-34.',true);
  UPDATE lots SET geometry=ST_Translate(geometry,0,north_delta)::geometry(MultiPolygon,4326),
    geometry_source='Migration 495: eighteen-lot group translation one foot north.',
    geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
      'A-1 through A-9 and A-30 through A-38 moved together one foot north; shared edges, dimensions and relative positions preserved. TLC-HS-0053 remains fixed, strictly inside A-34. See ADR 0170.'),
    updated_at=now()
  WHERE id=ANY(target_ids);
END
$shift$;

-- Recovery uses the pre-migration backup or a reviewed forward correction.
--rollback empty
