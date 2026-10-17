--liquibase formatted sql

--changeset cemeterymapping:458-add-weitzel-estimated-monument splitStatements:false
DO $$
DECLARE
  reference headstones%ROWTYPE;
  point geometry(Point,4326);
BEGIN
  SELECT h.* INTO reference FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    WHERE h.headstone_id='TLC-HS-0500' AND h.deleted_at IS NULL
      AND g.gravesite_id='TLC-GPS-0500' AND g.section_id='D' AND g.deleted_at IS NULL;
  IF NOT FOUND THEN
    PERFORM assert_migration_prerequisite(NOT EXISTS (
      SELECT 1 FROM headstones WHERE headstone_id='TLC-HS-0500' AND deleted_at IS NULL),
      'active TLC-HS-0500 must belong to active D-0500');
    RETURN;
  END IF;
  PERFORM assert_migration_prerequisite(reference.geometry IS NOT NULL,
    'TLC-HS-0500 must have its fixed reference point');
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM headstones
    WHERE headstone_id='TLC-HS-0577' OR (deleted_at IS NULL AND inscription ILIKE '%WEITZEL%')),
    'TLC-HS-0577 must be unused and the Weitzel monument must not already exist');
  PERFORM assert_migration_prerequisite(
    EXISTS (SELECT 1 FROM marker_types WHERE code='upright_headstone')
    AND EXISTS (SELECT 1 FROM marker_material_types WHERE code='gray_granite')
    AND EXISTS (SELECT 1 FROM headstone_condition_types WHERE code='unknown')
    AND EXISTS (SELECT 1 FROM marker_scope_types WHERE code='couple'),
    'upright headstone, gray granite, unknown condition and couple lookups must exist');

  -- Rounded operational estimate, not a photogrammetric or surveyed position.
  point := ST_Project(reference.geometry::geography,8*0.3048,0)::geometry;
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM headstones WHERE deleted_at IS NULL AND geometry IS NOT NULL
      AND ST_DWithin(geometry::geography,point::geography,0.15)),
    'estimated Weitzel point must not coincide with an existing monument');

  INSERT INTO headstones(headstone_id,marker_type,marker_type_id,material_type_id,
    condition_type_id,marker_scope_type_id,inscription,design_notes,back_description,
    geometry,latitude,longitude,data_confidence,review_status,review_notes,source_properties)
  VALUES('TLC-HS-0577','headstone',
    (SELECT id FROM marker_types WHERE code='upright_headstone'),
    (SELECT id FROM marker_material_types WHERE code='gray_granite'),
    (SELECT id FROM headstone_condition_types WHERE code='unknown'),
    (SELECT id FROM marker_scope_types WHERE code='couple'),
    E'WEITZEL\nJERRY LEE\nSEPT. 2, 1945\nSHIRLEY JANE\nOCT. 21, 1950\nNOV. 12, 2022',
    'Gray granite upright companion monument with engraved floral decoration; appearance assessed from photos.',
    'WEITZEL',point,ST_Y(point),ST_X(point),'low','needs_review',
    'ESTIMATED LOCATION: approximately 8 feet north of unchanged TLC-HS-0500, aligned with its longitude. Rounded working estimate from user-confirmed northward position and field-photo metadata; not a measured distance, triangulation, or survey. Camera GPS uncertainty is approximately 6 m (20 ft). The user identifies TLC-HS-0500’s shadow at the left edge of IMG_6597; no monument height or ground scale is available to calculate distance from that shadow. Verify on site. Names/dates are inscriptions only; no burial or gravesite assignments inferred. See ADR 0098.',
    jsonb_build_object(
      'Source','User-authorized estimated placement from Weitzel field photos, 2026-10-15',
      'EstimatedPosition',jsonb_build_object('referenceMarker','TLC-HS-0500','distanceFeet',8,
        'bearingDegrees',0,'surveyed',false,'confidence','low','method','Rounded northward offset; photo GPS represents camera positions with about 6 m uncertainty'),
      'Photos',jsonb_build_array(
        jsonb_build_object('filename','IMG_6597.HEIC','sha256','1054f62421fbd1f8465f501b05d756a623dd2eae190093ff812d8b47ec343716','capturedAt','2026-10-13T13:12:24-04:00','latitude',40.60160833333333,'longitude',-80.0805055,'headingDegreesTrue',284.7082825822168,'horizontalPositioningErrorMeters',6.032851381921904),
        jsonb_build_object('filename','IMG_6598.HEIC','sha256','570300526eb97e40ddb5b21570746d4cde98ac01a22bed1fbc440a9d955d6e9a','capturedAt','2026-10-13T13:12:51-04:00','latitude',40.6016,'longitude',-80.08051383333333,'headingDegreesTrue',264.5154723127036,'horizontalPositioningErrorMeters',6.015526647083508),
        jsonb_build_object('filename','IMG_6599.HEIC','sha256','b6b5eaaf66582e81ae28b724b522c2b382fcc44f18449161d46f8f7aabf6a94e','capturedAt','2026-10-13T13:12:58-04:00','latitude',40.60160833333333,'longitude',-80.08052783333333,'headingDegreesTrue',76.27413937867338,'horizontalPositioningErrorMeters',5.928068088221836)),
      'NormalizedProvenance',jsonb_build_object('verificationSourceType','field_photo','verifiedAt','2026-10-15')));
END $$;

-- Recover this field correction from the pre-migration backup if needed.
--rollback empty
