--liquibase formatted sql

--changeset cemeterymapping:388-split-a-0037-pfeiffer-gravesites splitStatements:false
DO $$
DECLARE
  source_grave gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  person_record record;
  burial_id uuid;
  target_id uuid;
  south_west geometry;
  north_west geometry;
  grave_geometry geometry;
BEGIN
  SELECT * INTO source_grave FROM gravesites
  WHERE gravesite_id = 'TLC-GPS-0037' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(upper(source_grave.section_id) = 'A',
    'TLC-GPS-0037 must belong to Section A');
  SELECT * INTO marker FROM headstones
  WHERE headstone_id = 'TLC-HS-0037' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(marker.id IS NOT NULL AND marker.geometry IS NOT NULL,
    'active marker TLC-HS-0037 with geometry must exist');

  FOR person_record IN
    SELECT * FROM (VALUES
      ('Walter H Pfeiffer', '0037', 'TLC-GPS-0037', -4),
      ('Lynn C Pfeiffer', '0037A', 'TLC-GPS-0037-01', 0),
      ('Harry Ralph Pfeiffer', '0037B', 'TLC-GPS-0037-02', 4)
    ) AS people(full_name, grave_id, gravesite_id, south_offset_feet)
  LOOP
    PERFORM assert_migration_prerequisite((
      SELECT count(*) = 1 FROM burials b
      JOIN headstone_burials hb ON hb.burial_uuid = b.id
      WHERE hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
        AND b.deleted_at IS NULL AND lower(b.full_name) = lower(person_record.full_name)
    ), 'exactly one active linked burial must exist for ' || person_record.full_name);
    SELECT b.id INTO burial_id FROM burials b
    JOIN headstone_burials hb ON hb.burial_uuid = b.id
    WHERE hb.headstone_uuid = marker.id AND hb.deleted_at IS NULL
      AND b.deleted_at IS NULL AND lower(b.full_name) = lower(person_record.full_name);

    IF person_record.south_offset_feet < 0 THEN
      south_west := ST_Project(marker.geometry::geography, 4 * 0.3048, pi())::geometry;
    ELSE
      south_west := ST_Project(marker.geometry::geography, person_record.south_offset_feet * 0.3048, 0)::geometry;
    END IF;
    north_west := ST_Project(marker.geometry::geography, (person_record.south_offset_feet + 4) * 0.3048, 0)::geometry;
    grave_geometry := ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_west,
      ST_Project(south_west::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_west::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_west, south_west
    ])), 4326));

    IF person_record.gravesite_id = source_grave.gravesite_id THEN
      target_id := source_grave.id;
      UPDATE gravesites SET name = person_record.full_name, geometry = grave_geometry,
        width_feet = 4, length_feet = 10, geometry_type = 'operational',
        geometry_confidence = 'estimated',
        geometry_source = 'Split TLC-GPS-0037 around fixed marker TLC-HS-0037.',
        geometry_notes = concat_ws(' ', NULLIF(geometry_notes, ''),
          'Walter H Pfeiffer retained in A-0037 south of the fixed marker; Lynn C Pfeiffer and Harry Ralph Pfeiffer placed in consecutive graves north on 2026-09-10.'),
        updated_at = now()
      WHERE id = target_id;
    ELSE
      PERFORM assert_migration_prerequisite(NOT EXISTS (
        SELECT 1 FROM gravesites g WHERE g.gravesite_id = person_record.gravesite_id
          AND (g.name IS DISTINCT FROM person_record.full_name OR g.cemetery_id IS DISTINCT FROM source_grave.cemetery_id)
      ), person_record.gravesite_id || ' must be unused or belong to the intended person and cemetery');
      INSERT INTO gravesites (
        cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
        grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
        geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
      ) VALUES (
        source_grave.cemetery_id, source_grave.section_uuid, source_grave.block_uuid, source_grave.lot_uuid,
        person_record.full_name, source_grave.facility_id, source_grave.section_id, source_grave.block_id, source_grave.lot_id,
        person_record.grave_id, person_record.gravesite_id, source_grave.cost, grave_geometry, 4, 10, source_grave.status_type_id,
        'operational', 'Split TLC-GPS-0037 around fixed marker TLC-HS-0037.', 'estimated',
        person_record.full_name || ' assigned to A-' || person_record.grave_id || ' north of A-0037 on 2026-09-10; south-to-north order Walter, Lynn, Harry Ralph.', now()
      ) ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
        section_uuid = EXCLUDED.section_uuid, block_uuid = EXCLUDED.block_uuid, lot_uuid = EXCLUDED.lot_uuid,
        name = EXCLUDED.name, facility_id = EXCLUDED.facility_id, section_id = EXCLUDED.section_id,
        block_id = EXCLUDED.block_id, lot_id = EXCLUDED.lot_id, grave_id = EXCLUDED.grave_id,
        cost = EXCLUDED.cost, geometry = EXCLUDED.geometry, width_feet = EXCLUDED.width_feet,
        length_feet = EXCLUDED.length_feet, status_type_id = EXCLUDED.status_type_id,
        geometry_type = EXCLUDED.geometry_type, geometry_source = EXCLUDED.geometry_source,
        geometry_confidence = EXCLUDED.geometry_confidence, geometry_notes = EXCLUDED.geometry_notes,
        updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
      RETURNING id INTO target_id;
    END IF;

    UPDATE burials SET gravesite_uuid = target_id, gravesite_id = person_record.gravesite_id, updated_at = now()
    WHERE id = burial_id;
    INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
    VALUES (marker.id, target_id, 'spans', now())
    ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
      relationship_type = 'spans', updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL;
  END LOOP;

  UPDATE headstones SET gravesite_uuid = source_grave.id, updated_at = now() WHERE id = marker.id;
END $$;

--rollback empty
