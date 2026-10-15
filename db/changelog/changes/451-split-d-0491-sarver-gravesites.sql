--liquibase formatted sql

--changeset cemeterymapping:451-split-d-0491-sarver-gravesites splitStatements:false
DO $$
DECLARE
  source gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  elizabeth_id uuid;
  new_grave_id uuid := gen_random_uuid();
  shared_west geometry;
  north_west geometry;
  south_west geometry;
  north_geometry geometry;
  south_geometry geometry;
BEGIN
  SELECT * INTO source FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0491' AND section_id = 'D' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO marker FROM headstones
    WHERE headstone_id = 'TLC-HS-0491' AND gravesite_uuid = source.id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND AND marker.geometry IS NOT NULL,
    'TLC-HS-0491 must have its fixed point and belong to active D-0491');
  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM burials WHERE gravesite_uuid = source.id AND deleted_at IS NULL) = 2
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name = 'Jacob Sarver') = 1
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name = 'Elizabeth Sarver') = 1,
    'exactly Jacob Sarver and Elizabeth Sarver must occupy D-0491 and link to TLC-HS-0491');
  SELECT id INTO elizabeth_id FROM burials
    WHERE gravesite_uuid = source.id AND full_name = 'Elizabeth Sarver' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM gravesites WHERE cemetery_id = source.cemetery_id
      AND (gravesite_id = 'TLC-GPS-0491-01' OR (section_id = 'D' AND grave_id = '0491A'))),
    'new D-0491A / TLC-GPS-0491-01 identifiers must be unused');

  -- Keep the headstone at the shared western corner of the two graves.
  shared_west := marker.geometry;
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
    'both 4-by-10-foot Sarver graves must be valid and avoid other active graves');

  UPDATE gravesites SET name = 'Jacob Sarver', geometry = south_geometry,
    width_feet = 4, length_feet = 10, geometry_type = 'operational', geometry_confidence = 'estimated',
    geometry_source = 'Migration 451: split D-0491 around fixed TLC-HS-0491.',
    geometry_notes = concat_ws(' ',NULLIF(geometry_notes,''),
      'User-directed split on 2026-10-15: Jacob remains in D-0491 south of Elizabeth in D-0491A. Both graves are 4 feet north-south by 10 feet east-west, extending east from the marker line. Shared western corner is the unchanged marker point. Estimated operational placement; field survey may refine burial limits. See ADR 0092.'),
    updated_at = now() WHERE id = source.id;

  INSERT INTO gravesites (
    id, cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes
  ) VALUES (
    new_grave_id, source.cemetery_id, source.section_uuid, source.block_uuid, source.lot_uuid,
    'Elizabeth Sarver', source.facility_id, source.section_id, source.block_id, source.lot_id,
    '0491A', 'TLC-GPS-0491-01', source.cost, north_geometry, 4, 10, source.status_type_id,
    'operational', 'Migration 451: split D-0491 around fixed TLC-HS-0491.', 'estimated',
    'Elizabeth assigned to D-0491A north of Jacob in D-0491 on 2026-10-15. Both graves are 4 feet north-south by 10 feet east-west. Shared western corner is the unchanged TLC-HS-0491 point. Estimated operational placement; field survey may refine burial limits. See ADR 0092.'
  );
  UPDATE burials SET gravesite_uuid = new_grave_id, gravesite_id = 'TLC-GPS-0491-01',
    updated_at = now() WHERE id = elizabeth_id;
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type)
    VALUES (marker.id, source.id, 'primary'), (marker.id, new_grave_id, 'spans')
    ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type, deleted_at = NULL, deleted_by = NULL,
      delete_reason = NULL, updated_at = now();
END $$;

-- Preserve this correction; recover from the pre-migration backup if needed.
--rollback empty
