--liquibase formatted sql

--changeset cemeterymapping:389-add-a-0038-crea-common-base-marker splitStatements:false
DO $$
DECLARE
  original gravesites%ROWTYPE;
  james_marker headstones%ROWTYPE;
  ella burials%ROWTYPE;
  new_grave uuid;
  new_marker uuid;
  north_point geometry;
  north_geometry geometry;
  latitude_offset double precision;
BEGIN
  SELECT * INTO original FROM gravesites WHERE gravesite_id = 'TLC-GPS-0038' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO james_marker FROM headstones WHERE headstone_id = 'TLC-HS-0038' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(original.section_id = 'A' AND original.geometry IS NOT NULL
    AND james_marker.geometry IS NOT NULL AND james_marker.gravesite_uuid = original.id,
    'A-0038 and its active primary marker must exist with geometry');
  PERFORM assert_migration_prerequisite((SELECT count(*) = 1 FROM burials b
    JOIN headstone_burials hb ON hb.burial_uuid = b.id
    WHERE hb.headstone_uuid = james_marker.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.full_name = 'Ella R Pfeiffer' AND b.gravesite_uuid = original.id),
    'Exactly one Ella R Pfeiffer burial must be linked to TLC-HS-0038 and A-0038');
  SELECT b.* INTO ella FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
    WHERE hb.headstone_uuid = james_marker.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.full_name = 'Ella R Pfeiffer' AND b.gravesite_uuid = original.id;
  PERFORM assert_migration_prerequisite(EXISTS (SELECT 1 FROM burials b
    JOIN headstone_burials hb ON hb.burial_uuid = b.id
    WHERE hb.headstone_uuid = james_marker.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.full_name = 'James H Crea' AND b.gravesite_uuid = original.id),
    'James H Crea must remain linked to the original marker and grave');
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0038A')
    AND NOT EXISTS (SELECT 1 FROM gravesites WHERE cemetery_id = original.cemetery_id
      AND (gravesite_id = 'TLC-GPS-0038-01' OR (section_id = 'A' AND grave_id = '0038A'))),
    'New marker and grave identifiers must be unused');

  -- Preserve the original surveyed marker and polygon. Place the new estimated
  -- polygon directly against its north edge, using the same width and length.
  latitude_offset := ST_YMax(original.geometry) - ST_YMin(original.geometry);
  north_geometry := ST_Translate(original.geometry, 0, latitude_offset);
  north_point := ST_Translate(james_marker.geometry, 0, latitude_offset);
  INSERT INTO gravesites (cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id,
    section_id, block_id, lot_id, grave_id, gravesite_id, cost, geometry, width_feet, length_feet,
    status_type_id, geometry_type, geometry_source, geometry_confidence, geometry_notes)
  VALUES (original.cemetery_id, original.section_uuid, original.block_uuid, original.lot_uuid,
    ella.full_name, original.facility_id, original.section_id, original.block_id, original.lot_id,
    '0038A', 'TLC-GPS-0038-01', original.cost, north_geometry, original.width_feet, original.length_feet,
    original.status_type_id, 'operational', 'User field review 2026-09-14; north of A-0038.', 'estimated',
    'Ella R Pfeiffer (wife of James H Crea). Separate marker on a common base with TLC-HS-0038. Polygon and marker estimated one existing grave-width north; original geometry unchanged.')
  RETURNING id INTO new_grave;

  INSERT INTO headstones (gravesite_uuid, headstone_id, marker_type, marker_type_id, material,
    material_type_id, condition_type_id, marker_scope_type_id, inscription, design_notes,
    geometry, latitude, longitude, data_confidence, review_status, review_notes, source_properties)
  VALUES (new_grave, 'TLC-HS-0038A', 'headstone',
    (SELECT id FROM marker_types WHERE code = 'upright_headstone'), 'gray granite',
    (SELECT id FROM marker_material_types WHERE code = 'gray_granite'),
    (SELECT id FROM headstone_condition_types WHERE code = 'unknown'),
    (SELECT id FROM marker_scope_types WHERE code = 'single'),
    E'Ella R. Pfeiffer\nwife of\nJames H. Crea\n1886-1962', 'Wild roses (NHG reading).',
    north_point, ST_Y(north_point), ST_X(north_point), 'medium', 'needs_review',
    'NHG (5A, 3, s) describes a separate upright gray-granite marker on a common base with James H Crea (5A, 2). User confirmed the separate marker north on 2026-09-14. Position is estimated; current condition not assessed.',
    jsonb_build_object('Source', 'NHG reading and user field review 2026-09-14',
      'NhgSection', 'A', 'NhgRow', '5', 'SharedCommonBase', jsonb_build_object(
        'relatedMarkerId', 'TLC-HS-0038', 'individualPointMethod', 'One existing grave-width north of unchanged TLC-HS-0038; estimated, not surveyed.',
        'referenceLatitude', ST_Y(james_marker.geometry), 'referenceLongitude', ST_X(james_marker.geometry))))
  RETURNING id INTO new_marker;

  UPDATE burials SET gravesite_uuid = new_grave, gravesite_id = 'TLC-GPS-0038-01', updated_at = now()
    WHERE id = ella.id;
  UPDATE headstone_burials SET deleted_at = now(),
    delete_reason = 'Ella has separate marker TLC-HS-0038A on the common base.'
    WHERE headstone_uuid = james_marker.id AND burial_uuid = ella.id AND deleted_at IS NULL;
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid) VALUES (new_marker, ella.id);
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
    VALUES (new_marker, new_grave, 'primary', 'Ella R Pfeiffer separate marker on the common Crea base.');
  UPDATE headstones SET marker_scope_type_id = (SELECT id FROM marker_scope_types WHERE code = 'single'),
    updated_at = now() WHERE id = james_marker.id;
  INSERT INTO headstone_relationships (from_headstone_uuid, to_headstone_uuid, relationship_type,
    source_type, source_text, confidence, notes, status)
    VALUES (james_marker.id, new_marker, 'common_base', 'field_observation',
      'User confirmed separate markers on the same base, with Ella north of James, 2026-09-14; corroborated by NHG (5A, 2) and (5A, 3).',
      'high', 'Separate primary markers for separate gravesites. New coordinates are estimated; original coordinates preserved.', 'active');
END $$;

--rollback empty
