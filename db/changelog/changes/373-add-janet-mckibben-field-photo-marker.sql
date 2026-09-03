--liquibase formatted sql

--changeset cemeterymapping:373-add-janet-mckibben-field-photo-marker splitStatements:false
DO $$
DECLARE
  cemetery_uuid uuid;
  section_uuid_value uuid;
  grave_uuid uuid;
  marker_uuid uuid;
  burial_uuid_value uuid;
  marker_point geometry(Point, 4326);
  west_center geometry(Point, 4326);
  grave_polygon geometry(MultiPolygon, 4326);
  provenance jsonb;
BEGIN
  -- Fail rather than overwrite an unrelated record if this sequence number is allocated elsewhere.
  PERFORM assert_migration_prerequisite(
    NOT EXISTS (SELECT 1 FROM gravesites WHERE grave_id = '0576' OR gravesite_id = 'TLC-GPS-0576')
    AND NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0576')
    AND NOT EXISTS (SELECT 1 FROM burials WHERE gravesite_id = 'TLC-GPS-0576'
      OR lower(trim(full_name)) = 'janet barczak mckibben'),
    '0576 must be unused and Janet Barczak McKibben must not already have a burial record'
  );

  SELECT c.id, s.section_id INTO STRICT cemetery_uuid, section_uuid_value
  FROM cemeteries c JOIN sections s ON s.cemetery_id = c.id
  WHERE c.facility_id = '1' AND c.deleted_at IS NULL
    AND upper(s.name) = 'A' AND s.deleted_at IS NULL;

  SELECT ST_LineInterpolatePoint(ST_MakeLine(south.geometry, north.geometry), 0.5)
  INTO STRICT marker_point
  FROM headstones south
  JOIN gravesites sg ON sg.id = south.gravesite_uuid
  CROSS JOIN headstones north
  JOIN gravesites ng ON ng.id = north.gravesite_uuid
  WHERE south.headstone_id = 'TLC-HS-0021' AND north.headstone_id = 'TLC-HS-0022'
    AND south.deleted_at IS NULL AND north.deleted_at IS NULL
    AND sg.deleted_at IS NULL AND ng.deleted_at IS NULL
    AND sg.cemetery_id = cemetery_uuid AND ng.cemetery_id = cemetery_uuid
    AND sg.section_uuid = section_uuid_value AND ng.section_uuid = section_uuid_value
    AND sg.grave_id = '0021' AND ng.grave_id = '0022';

  PERFORM assert_migration_prerequisite(marker_point IS NOT NULL,
    'Both neighboring markers must have mapped geometry');

  -- Standard provisional 4 x 10 ft space extending east, not a surveyed boundary.
  west_center := ST_Project(marker_point::geography, 0.35, 3 * pi() / 2)::geometry;
  grave_polygon := ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[
    ST_Project(west_center::geography, 2 * 0.3048, pi())::geometry,
    ST_Project(ST_Project(west_center::geography, 2 * 0.3048, pi()), 10 * 0.3048, pi() / 2)::geometry,
    ST_Project(ST_Project(west_center::geography, 2 * 0.3048, 0), 10 * 0.3048, pi() / 2)::geometry,
    ST_Project(west_center::geography, 2 * 0.3048, 0)::geometry,
    ST_Project(west_center::geography, 2 * 0.3048, pi())::geometry
  ])));

  provenance := jsonb_build_object(
    'Source', 'field photos', 'SourceFormat', 'Apple HEIC',
    'DeviceMake', 'Apple', 'DeviceModel', 'iPhone 15 Pro',
    'Photos', jsonb_build_array(
      jsonb_build_object('filename', 'IMG_6211.HEIC',
        'sha256', '1b86cc21e629a4f2e72f59965f8d85eb6826457d75775b28bb6d1d5cf1dc7efa',
        'capturedAt', '2026-08-28T19:12:39-04:00', 'horizontalPositioningErrorMeters', 2.24482777150841),
      jsonb_build_object('filename', 'IMG_6212.HEIC',
        'sha256', '753f61b7a6a250337cca464f171697622aa2017d98fd1eab4c07c3875ca0b9a3',
        'capturedAt', '2026-08-28T19:12:48-04:00', 'horizontalPositioningErrorMeters', 2.206376520637652)
    ),
    'RawExifGps', jsonb_build_object('latitude', 40.60122833333333,
      'longitude', -80.07980283333333),
    'CoordinateSource', 'Estimated midpoint between fixed markers TLC-HS-0021 and TLC-HS-0022 using user-confirmed adjacency',
    'AdjustedGeometry', jsonb_build_object('latitude', ST_Y(marker_point),
      'longitude', ST_X(marker_point),
      'reason', 'User places this marker between A-0021 and A-0022; phone GPS is approximate camera location, not a survey.'),
    'ObservedAppearance', 'Heart-shaped gray granite marker with engraved flowers, praying hands, and an integrated vase opening. Exact marker subtype unverified.',
    'NormalizedProvenance', jsonb_build_object('nhgInclusion', 'not_listed',
      'importedGravesiteSpreadsheetInclusion', 'not_listed',
      'verificationSourceType', 'field_photo', 'verifiedAt', '2026-09-03')
  );

  INSERT INTO gravesites (
    cemetery_id, section_uuid, name, facility_id, section_id, grave_id, gravesite_id,
    width_feet, length_feet, status_type_id, geometry, geometry_type,
    geometry_source, geometry_confidence, geometry_notes
  ) VALUES (
    cemetery_uuid, section_uuid_value, 'Janet Barczak McKibben', '1', 'A', '0576', 'TLC-GPS-0576',
    4, 10, (SELECT id FROM gravesite_status_types WHERE code = 'occupied'),
    grave_polygon, 'operational',
    'Field photos IMG_6211.HEIC and IMG_6212.HEIC; user-confirmed position between A-0021 and A-0022.',
    'estimated',
    'Needs Review: midpoint placement and standard 4 x 10 ft dimensions are provisional, not surveyed. Existing neighbors remain unchanged. Number 0576 follows the overall sequence and does not imply kinship with neighboring graves.'
  ) RETURNING id INTO grave_uuid;

  INSERT INTO headstones (
    gravesite_uuid, headstone_id, marker_type, inscription, material,
    latitude, longitude, geometry, source_properties, last_inspected_at,
    marker_type_id, material_type_id, condition_type_id,
    data_confidence, review_status, review_notes
  ) VALUES (
    grave_uuid, 'TLC-HS-0576', 'headstone',
    E'JANET\nBARCZAK McKIBBEN\nJULY 16, 1941\nMAY 6, 2024', 'gray granite',
    ST_Y(marker_point), ST_X(marker_point), marker_point, provenance, DATE '2026-08-28',
    (SELECT id FROM marker_types WHERE code = 'other'),
    (SELECT id FROM marker_material_types WHERE code = 'gray_granite'),
    (SELECT id FROM headstone_condition_types WHERE code = 'good'),
    'medium', 'needs_review',
    'Identity and dates transcribed from two field photos. Heart-shaped marker; verify exact subtype and estimated location by field measurement. Material and condition are visual assessments.'
  ) RETURNING id INTO marker_uuid;

  INSERT INTO burials (
    gravesite_uuid, gravesite_id, first_name, last_name, full_name,
    birth_date, death_date, birth_date_text, death_date_text,
    interment_type_id, burial_record_status_type_id,
    data_confidence, review_status, review_notes, notes, source_properties
  ) VALUES (
    grave_uuid, 'TLC-GPS-0576', 'Janet', 'Barczak McKibben', 'Janet Barczak McKibben',
    DATE '1941-07-16', DATE '2024-05-06', 'July 16, 1941', 'May 6, 2024',
    (SELECT id FROM burial_interment_types WHERE code = 'unknown'),
    (SELECT id FROM burial_record_status_types WHERE code = 'interred'),
    'medium', 'needs_review',
    'Verify official interment record, burial date, and interment type. Barczak is preserved as inscribed, not asserted to be a maiden name. Sex and veteran status are unknown.',
    'New burial record requested from field-photo evidence. Not listed in NHG or the imported spreadsheet. Interred status follows the user burial identification; interment details remain unverified.',
    provenance
  ) RETURNING id INTO burial_uuid_value;

  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
  VALUES (marker_uuid, grave_uuid, 'primary', 'Janet Barczak McKibben field-photo marker and estimated gravesite.');
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  VALUES (marker_uuid, burial_uuid_value);
END $$;

-- Preserve field records on schema rollback; removal requires a separately reviewed data correction.
--rollback empty
