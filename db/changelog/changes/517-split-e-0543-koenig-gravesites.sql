--liquibase formatted sql

--changeset cemeterymapping:517-split-e-0543-koenig-gravesites splitStatements:false
--validCheckSum: 9:9c0fedbbc22acce3efc425d0c9ed0123
-- Compatibility: DEV already applied the original exact-accent prerequisite.
-- Hosted TEST retains ASCII Koenig names; preserve those existing burial details.
DO $$
DECLARE
  source gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  nicholas_id uuid;
  new_grave_id uuid := gen_random_uuid();
  ring geometry;
  dx double precision;
  dy double precision;
  southeast_geometry geometry;
BEGIN
  SELECT * INTO source FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0543' AND section_id = 'E' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO marker FROM headstones
    WHERE headstone_id = 'TLC-HS-0543' AND gravesite_uuid = source.id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND AND marker.geometry IS NOT NULL,
    'TLC-HS-0543 must have its fixed point and belong to active E-0543');
  PERFORM assert_migration_prerequisite(
    (SELECT count(*) FROM burials WHERE gravesite_uuid = source.id AND deleted_at IS NULL) = 2
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name IN ('Margareta Köenig','Margareta Koenig')) = 1
    AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE b.gravesite_uuid = source.id AND b.deleted_at IS NULL
        AND hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.full_name IN ('Nicholas Köenig','Nicholas Koenig')) = 1,
    'exactly Margareta Köenig and Nicholas Köenig must occupy E-0543 and link to TLC-HS-0543');
  SELECT id INTO nicholas_id FROM burials
    WHERE gravesite_uuid = source.id AND full_name IN ('Nicholas Köenig','Nicholas Koenig') AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM gravesites WHERE cemetery_id = source.cemetery_id
      AND (gravesite_id = 'TLC-GPS-0543-01' OR (section_id = 'E' AND grave_id = '0543A'))),
    'new E-0543A / TLC-GPS-0543-01 identifiers must be unused');

  PERFORM assert_migration_prerequisite(source.geometry IS NOT NULL
    AND ST_IsValid(source.geometry) AND ST_NumGeometries(source.geometry)=1
    AND ST_NPoints(ST_ExteriorRing(ST_GeometryN(source.geometry,1)))=5
    AND source.width_feet=4 AND source.length_feet=10,
    'E-0543 must have its existing valid 4-by-10-foot operational quadrilateral');
  ring := ST_ExteriorRing(ST_GeometryN(source.geometry,1));
  dx := ST_X(ST_PointN(ring,2))-ST_X(ST_PointN(ring,1));
  dy := ST_Y(ST_PointN(ring,2))-ST_Y(ST_PointN(ring,1));
  PERFORM assert_migration_prerequisite(dx>0 AND dy<0
    AND abs(ST_Distance(ST_PointN(ring,1)::geography,ST_PointN(ring,2)::geography)/0.3048-4)<0.1,
    'E-0543 first edge must be its four-foot southeast width');
  southeast_geometry := ST_Translate(source.geometry,dx,dy);
  PERFORM assert_migration_prerequisite(ST_IsValid(southeast_geometry),
    'Nicholas southeast polygon must be valid');

  UPDATE gravesites SET name = 'Margareta Köenig', geometry = source.geometry,
    width_feet = 4, length_feet = 10, geometry_type = 'operational', geometry_confidence = 'estimated',
    geometry_source = 'Migration 517: split E-0543 beside fixed TLC-HS-0543.',
    geometry_notes = concat_ws(' ',NULLIF(geometry_notes,''),
      'Owner correction 2026-11-12: Margareta remains in E-0543, with unchanged geometry. Nicholas occupies adjoining E-0543A southeast, following the existing orientation. TLC-HS-0543 stays fixed. Estimated historic boundaries; owner accepts overlap with E-0573 because accurate limits are difficult to maintain. Neighbors remain unchanged. See ADR 0207.'),
    updated_at = now() WHERE id = source.id;

  INSERT INTO gravesites (
    id, cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes
  ) VALUES (
    new_grave_id, source.cemetery_id, source.section_uuid, source.block_uuid, source.lot_uuid,
    'Nicholas Köenig', source.facility_id, source.section_id, source.block_id, source.lot_id,
    '0543A', 'TLC-GPS-0543-01', source.cost, southeast_geometry, 4, 10, source.status_type_id,
    'operational', 'Migration 517: split E-0543 beside fixed TLC-HS-0543.', 'estimated',
    'Nicholas Köenig assigned to E-0543A southeast of unchanged E-0543 on 2026-11-12. Existing 4-by-10-foot outline translated one width southeast; estimated operational placement, not surveyed interment limits. Owner accepts overlap with E-0573 in this old section. Monument and neighboring graves remain unchanged. See ADR 0207.'
  );
  UPDATE burials SET gravesite_uuid = new_grave_id, gravesite_id = 'TLC-GPS-0543-01',
    updated_at = now() WHERE id = nicholas_id;
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type)
    VALUES (marker.id, source.id, 'primary'), (marker.id, new_grave_id, 'spans')
    ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type, deleted_at = NULL, deleted_by = NULL,
      delete_reason = NULL, updated_at = now();
END $$;

-- Preserve this correction; recover from the pre-migration backup if needed.
--rollback empty
