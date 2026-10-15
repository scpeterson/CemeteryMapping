--liquibase formatted sql

--changeset cemeterymapping:450-split-d-0485-mehrlich-common-base-markers splitStatements:false
DO $$
DECLARE
  source gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  margaret_id uuid;
  new_grave_id uuid := gen_random_uuid();
  new_marker_id uuid;
  new_marker_point geometry;
  shared_west geometry;
  north_west geometry;
  south_west geometry;
  north_geometry geometry;
  south_geometry geometry;
BEGIN
  SELECT * INTO source FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0485' AND section_id = 'D' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO marker FROM headstones
    WHERE headstone_id = 'TLC-HS-0485' AND gravesite_uuid = source.id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND AND marker.geometry IS NOT NULL,
    'TLC-HS-0485 must have its fixed point and belong to active D-0485');
  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM burials WHERE gravesite_uuid = source.id AND deleted_at IS NULL) = 2
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name = 'John Mehrlich') = 1
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name = 'Margaret Mehrlich') = 1,
    'exactly John Mehrlich and Margaret Mehrlich must occupy D-0485 and link to TLC-HS-0485');
  SELECT id INTO margaret_id FROM burials
    WHERE gravesite_uuid = source.id AND full_name = 'Margaret Mehrlich' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM gravesites WHERE cemetery_id = source.cemetery_id
      AND (gravesite_id = 'TLC-GPS-0485-01' OR (section_id = 'D' AND grave_id = '0485A'))),
    'new D-0485A / TLC-GPS-0485-01 identifiers must be unused');
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id='TLC-HS-0485A'),
    'new marker TLC-HS-0485A identifier must be unused');

  -- Preserve the surveyed point. Separate northern marker is estimated
  -- three feet north; polygons shift slightly west to avoid adjacent rows.
  new_marker_point := ST_Project(marker.geometry::geography,3*0.3048,0)::geometry;
  shared_west := ST_Project(marker.geometry::geography,0.3*0.3048,3*pi()/2)::geometry;
  north_west := ST_Project(shared_west::geography,4*0.3048,0)::geometry;
  south_west := ST_Project(shared_west::geography,4*0.3048,pi())::geometry;
  north_geometry := ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[
    shared_west,ST_Project(shared_west::geography,10*0.3048,pi()/2)::geometry,
    ST_Project(north_west::geography,10*0.3048,pi()/2)::geometry,north_west,shared_west])));
  south_geometry := ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[
    south_west,ST_Project(south_west::geography,10*0.3048,pi()/2)::geometry,
    ST_Project(shared_west::geography,10*0.3048,pi()/2)::geometry,shared_west,south_west])));
  PERFORM assert_migration_prerequisite(ST_IsValid(north_geometry) AND ST_IsValid(south_geometry)
    AND NOT EXISTS (
      SELECT 1 FROM gravesites g WHERE g.cemetery_id = source.cemetery_id
        AND g.deleted_at IS NULL AND g.id <> source.id AND g.geometry IS NOT NULL
        AND (ST_Area(ST_Intersection(g.geometry,north_geometry)::geography) > 0.001
          OR ST_Area(ST_Intersection(g.geometry,south_geometry)::geography) > 0.001)),
    'both 4-by-10-foot Mehrlich graves must be valid and avoid other active graves');

  UPDATE gravesites SET name = 'John Mehrlich', geometry = south_geometry,
    width_feet = 4, length_feet = 10, geometry_type = 'operational', geometry_confidence = 'estimated',
    geometry_source = 'Migration 450: split D-0485 around fixed TLC-HS-0485.',
    geometry_notes = concat_ws(' ',NULLIF(geometry_notes,''),
      'User-directed split on 2026-10-15: John remains in D-0485 south of Margaret in D-0485A. Both graves are 4 feet north-south by 10 feet east-west, extending east from the marker line. Shared boundary is at the latitude of the unchanged John marker; polygons extend from 0.3 feet west of it to avoid neighboring operational graves. Estimated operational placement; field survey may refine burial limits. See ADR 0091.'),
    updated_at = now() WHERE id = source.id;

  INSERT INTO gravesites (
    id, cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes
  ) VALUES (
    new_grave_id, source.cemetery_id, source.section_uuid, source.block_uuid, source.lot_uuid,
    'Margaret Mehrlich', source.facility_id, source.section_id, source.block_id, source.lot_id,
    '0485A', 'TLC-GPS-0485-01', source.cost, north_geometry, 4, 10, source.status_type_id,
    'operational', 'Migration 450: split D-0485 around fixed TLC-HS-0485.', 'estimated',
    'Margaret assigned to D-0485A north of John in D-0485 on 2026-10-15. Both graves are 4 feet north-south by 10 feet east-west. Separate marker TLC-HS-0485A is estimated 3 feet north of TLC-HS-0485 on their shared base; polygons begin 0.3 feet west of the John marker line. Estimated operational placement; field survey may refine burial limits. See ADR 0091.'
  );
  UPDATE burials SET gravesite_uuid = new_grave_id, gravesite_id = 'TLC-GPS-0485-01',
    updated_at = now() WHERE id = margaret_id;
  INSERT INTO headstones (
    gravesite_uuid, headstone_id, marker_type, marker_type_id, material_type_id,
    condition_type_id, marker_scope_type_id, inscription, geometry, latitude, longitude,
    data_confidence, review_status, review_notes, source_properties
  ) VALUES (
    new_grave_id, 'TLC-HS-0485A', 'headstone',
    (SELECT id FROM marker_types WHERE code='upright_headstone'), marker.material_type_id,
    (SELECT id FROM headstone_condition_types WHERE code='unknown'),
    (SELECT id FROM marker_scope_types WHERE code='single'),
    E'MARGARETE MEHRLICH\nMAY 2, 1834\nAUG. 23, 1910\nMOTHER',
    new_marker_point, ST_Y(new_marker_point), ST_X(new_marker_point), 'medium', 'needs_review',
    'User confirmed separate Margaret Mehrlich monument on shared base on 2026-10-15. Point is estimated 3 feet north of TLC-HS-0485, not GPS surveyed. Inscription transcribed from supplied photo; condition not assessed.',
    jsonb_build_object('Source','User confirmation and supplied Mehrlich monument photo 2026-10-15',
      'EstimatedPosition',jsonb_build_object('referenceMarker','TLC-HS-0485','distanceFeet',3,'bearing','north','surveyed',false))
  ) RETURNING id INTO new_marker_id;
  UPDATE headstone_burials SET deleted_at=now(), deleted_by=NULL,
    delete_reason='Margaret has separate marker TLC-HS-0485A on the shared Mehrlich base.'
    WHERE headstone_uuid=marker.id AND burial_uuid=margaret_id AND deleted_at IS NULL;
  INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES(new_marker_id,margaret_id);
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type)
    VALUES (marker.id, source.id, 'primary'), (new_marker_id, new_grave_id, 'primary')
    ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type, deleted_at = NULL, deleted_by = NULL,
      delete_reason = NULL, updated_at = now();
  INSERT INTO headstone_relationships(from_headstone_uuid,to_headstone_uuid,relationship_type,
    source_type,source_text,confidence,notes,status)
    VALUES(marker.id,new_marker_id,'common_base','field_observation',
      'User confirmation and photograph on 2026-10-15 show John and Margaret Mehrlich monuments on a shared base.',
      'high','Separate graves and individual markers; Margaret marker point estimated 3 feet north, not GPS surveyed.','active');
END $$;

-- Preserve this correction; recover from the pre-migration backup if needed.
--rollback empty
