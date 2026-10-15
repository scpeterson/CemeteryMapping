--liquibase formatted sql

--changeset cemeterymapping:457-split-d-0500-brant-gravesites splitStatements:false
DO $$
DECLARE
  source gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  bonnie_id uuid;
  new_grave_id uuid := gen_random_uuid();
  shared_west geometry;
  north_west geometry;
  north_geometry geometry;
BEGIN
  SELECT * INTO source FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0500' AND section_id = 'D' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO marker FROM headstones
    WHERE headstone_id = 'TLC-HS-0500' AND gravesite_uuid = source.id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND AND marker.geometry IS NOT NULL,
    'TLC-HS-0500 must have its fixed point and belong to active D-0500');
  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM burials WHERE gravesite_uuid = source.id AND deleted_at IS NULL) = 2
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name = 'Clifford Cornell Brant') = 1
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name = 'Bonnie Louise Brant') = 1,
    'exactly Clifford Cornell Brant and Bonnie Louise Brant must occupy D-0500 and link to TLC-HS-0500');
  SELECT id INTO bonnie_id FROM burials
    WHERE gravesite_uuid = source.id AND full_name = 'Bonnie Louise Brant' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM gravesites WHERE cemetery_id = source.cemetery_id
      AND (gravesite_id = 'TLC-GPS-0500-01' OR (section_id = 'D' AND grave_id = '0500A'))),
    'new D-0500A / TLC-GPS-0500-01 identifiers must be unused');

  -- Preserve D-0500 and its fixed monument; moving south would overlap D-0499A.
  PERFORM assert_migration_prerequisite(source.geometry IS NOT NULL
    AND ST_IsValid(source.geometry) AND source.width_feet=4 AND source.length_feet=10,
    'D-0500 must retain its valid existing 4-by-10-foot geometry');
  shared_west := ST_SetSRID(ST_MakePoint(ST_XMin(source.geometry),ST_YMax(source.geometry)),4326);
  north_west := ST_Project(shared_west::geography,4*0.3048,0)::geometry;
  north_geometry := ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[
    shared_west,ST_Project(shared_west::geography,10*0.3048,pi()/2)::geometry,
    ST_Project(north_west::geography,10*0.3048,pi()/2)::geometry,north_west,shared_west])));
  PERFORM assert_migration_prerequisite(ST_IsValid(north_geometry)
    AND NOT EXISTS (
      SELECT 1 FROM gravesites g WHERE g.cemetery_id = source.cemetery_id
        AND g.deleted_at IS NULL AND g.geometry IS NOT NULL
        AND ST_Area(ST_Intersection(g.geometry,north_geometry)::geography) > 0.001),
    'new 4-by-10-foot Bonnie Brant grave must be valid and avoid other active graves');

  INSERT INTO gravesites (
    id, cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes
  ) VALUES (
    new_grave_id, source.cemetery_id, source.section_uuid, source.block_uuid, source.lot_uuid,
    'Bonnie Louise Brant', source.facility_id, source.section_id, source.block_id, source.lot_id,
    '0500A', 'TLC-GPS-0500-01', source.cost, north_geometry, 4, 10, source.status_type_id,
    'operational', 'Migration 457: create Bonnie Brant grave north of unchanged D-0500 and TLC-HS-0500.', 'estimated',
    'Bonnie Louise assigned to D-0500A north of Clifford Cornell in D-0500 on 2026-10-15. Both graves are 4 feet north-south by 10 feet east-west. Clifford Cornell’s original grave geometry and shared TLC-HS-0500 point remain unchanged to avoid D-0499A to the south. Estimated operational placement; field survey may refine burial limits. See ADR 0097.'
  );
  UPDATE burials SET gravesite_uuid = new_grave_id, gravesite_id = 'TLC-GPS-0500-01',
    updated_at = now() WHERE id = bonnie_id;
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type)
    VALUES (marker.id, source.id, 'primary'), (marker.id, new_grave_id, 'spans')
    ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type, deleted_at = NULL, deleted_by = NULL,
      delete_reason = NULL, updated_at = now();
END $$;

-- Preserve this correction; recover from the pre-migration backup if needed.
--rollback empty
