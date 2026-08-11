--liquibase formatted sql

--changeset cemeterymapping:310-add-eckendahl-field-photo-marker splitStatements:false
WITH source AS (
  SELECT
    'TLC-HS-0328A'::varchar AS headstone_id,
    40.60135277777778::numeric AS exif_latitude,
    -80.08044444444444::numeric AS exif_longitude,
    4.2260542057455135::numeric AS exif_accuracy_meters,
    TIMESTAMPTZ '2026-08-08 15:09:13-04:00' AS captured_at,
    jsonb_build_array(
      jsonb_build_object('filename', 'IMG_5918.HEIC', 'sha256', 'eb31f7afe3e1047d69d1ff779299bed44b56ed03044ded43edc74abf340e3244'),
      jsonb_build_object('filename', 'IMG_5919.HEIC', 'sha256', '916bbc8fd42aa5d2923051502d8bee324324756a3b64517f115c31f483ce754d'),
      jsonb_build_object('filename', 'IMG_5920.HEIC', 'sha256', 'fe52dd3836327b23251c1a6e51c8e3635189e666c92fbe367ab538c7b67be126')
    ) AS photos
),
context AS (
  SELECT
    source.*,
    cemeteries.id AS cemetery_id,
    cemeteries.facility_id,
    sections.section_id AS section_uuid,
    sections.name AS section_id,
    occupied.id AS occupied_status_type_id,
    reserved.id AS reserved_status_type_id,
    marker_types.id AS marker_type_id,
    marker_material_types.id AS material_type_id,
    headstone_condition_types.id AS condition_type_id,
    burial_interment_types.id AS interment_type_id,
    interred.id AS interred_status_type_id,
    pre_need.id AS pre_need_status_type_id,
    ST_LineInterpolatePoint(
      ST_MakeLine(south_marker.geometry, north_marker.geometry),
      0.5
    )::geometry(Point, 4326) AS marker_geometry
  FROM source
  JOIN cemeteries
    ON cemeteries.facility_id = '1'
   AND cemeteries.deleted_at IS NULL
  JOIN sections
    ON sections.cemetery_id = cemeteries.id
   AND upper(sections.name) = 'C'
   AND sections.deleted_at IS NULL
  JOIN headstones south_marker
    ON south_marker.headstone_id = 'TLC-HS-0328'
   AND south_marker.deleted_at IS NULL
  JOIN headstones north_marker
    ON north_marker.headstone_id = 'TLC-HS-0329'
   AND north_marker.deleted_at IS NULL
  JOIN gravesite_status_types occupied ON occupied.code = 'occupied'
  JOIN gravesite_status_types reserved ON reserved.code = 'reserved'
  JOIN marker_types ON marker_types.code = 'upright_headstone'
  JOIN marker_material_types ON marker_material_types.code = 'pink_granite'
  JOIN headstone_condition_types ON headstone_condition_types.code = 'excellent'
  JOIN burial_interment_types ON burial_interment_types.code = 'casket'
  JOIN burial_record_status_types interred ON interred.code = 'interred'
  JOIN burial_record_status_types pre_need ON pre_need.code = 'pre_need_inscription'
  LIMIT 1
),
grave_geometries AS (
  SELECT
    context.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      ST_Project(marker_geometry::geography, 4 * 0.3048, pi())::geometry,
      ST_Project(ST_Project(marker_geometry::geography, 4 * 0.3048, pi()), 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(marker_geometry::geography, 10 * 0.3048, pi() / 2)::geometry,
      marker_geometry,
      ST_Project(marker_geometry::geography, 4 * 0.3048, pi())::geometry
    ])), 4326))::geometry(MultiPolygon, 4326) AS bruce_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      marker_geometry,
      ST_Project(marker_geometry::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(ST_Project(marker_geometry::geography, 4 * 0.3048, 0), 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(marker_geometry::geography, 4 * 0.3048, 0)::geometry,
      marker_geometry
    ])), 4326))::geometry(MultiPolygon, 4326) AS terry_geometry
  FROM context
),
upserted_gravesites AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, name, facility_id, section_id, grave_id, gravesite_id,
    width_feet, length_feet, status_type_id, geometry, geometry_type, geometry_source,
    geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, 'Bruce W Eckendahl', facility_id, section_id,
    '0328B', 'TLC-GPS-0328-02', 4.00, 10.00, occupied_status_type_id, bruce_geometry,
    'operational',
    'Estimated from 2026 field photos and midpoint of fixed markers TLC-HS-0328 and TLC-HS-0329.',
    'estimated',
    'Southern Eckendahl space. Field evidence places TLC-HS-0328A between TLC-HS-0328 and TLC-HS-0329 in the same row. Existing estimated neighboring grave polygons overlap this two-space footprint and require future survey reconciliation.',
    now()
  FROM grave_geometries
  UNION ALL
  SELECT cemetery_id, section_uuid, 'Terry M Eckendahl', facility_id, section_id,
    '0328C', 'TLC-GPS-0328-03', 4.00, 10.00, reserved_status_type_id, terry_geometry,
    'operational',
    'Estimated from 2026 field photos and midpoint of fixed markers TLC-HS-0328 and TLC-HS-0329.',
    'estimated',
    'Northern pre-need Eckendahl space. Field evidence places TLC-HS-0328A between TLC-HS-0328 and TLC-HS-0329 in the same row. Existing estimated neighboring grave polygons overlap this two-space footprint and require future survey reconciliation.',
    now()
  FROM grave_geometries
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    section_uuid = EXCLUDED.section_uuid, name = EXCLUDED.name, facility_id = EXCLUDED.facility_id,
    section_id = EXCLUDED.section_id, grave_id = EXCLUDED.grave_id,
    width_feet = EXCLUDED.width_feet, length_feet = EXCLUDED.length_feet,
    status_type_id = EXCLUDED.status_type_id, geometry = EXCLUDED.geometry,
    geometry_type = EXCLUDED.geometry_type, geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence, geometry_notes = EXCLUDED.geometry_notes,
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()
  RETURNING id, gravesite_id
),
grave_context AS (
  SELECT grave_geometries.*,
    max(id::text) FILTER (WHERE gravesite_id = 'TLC-GPS-0328-02')::uuid AS bruce_gravesite_uuid,
    max(id::text) FILTER (WHERE gravesite_id = 'TLC-GPS-0328-03')::uuid AS terry_gravesite_uuid
  FROM grave_geometries CROSS JOIN upserted_gravesites
  GROUP BY grave_geometries.headstone_id, grave_geometries.exif_latitude,
    grave_geometries.exif_longitude, grave_geometries.exif_accuracy_meters,
    grave_geometries.captured_at, grave_geometries.photos, grave_geometries.cemetery_id,
    grave_geometries.facility_id, grave_geometries.section_uuid, grave_geometries.section_id,
    grave_geometries.occupied_status_type_id, grave_geometries.reserved_status_type_id,
    grave_geometries.marker_type_id, grave_geometries.material_type_id,
    grave_geometries.condition_type_id, grave_geometries.interred_status_type_id,
    grave_geometries.interment_type_id,
    grave_geometries.pre_need_status_type_id, grave_geometries.marker_geometry,
    grave_geometries.bruce_geometry, grave_geometries.terry_geometry
),
upserted_headstone AS (
  INSERT INTO headstones (
    gravesite_uuid, headstone_id, marker_type, inscription, material, latitude, longitude,
    geometry, source_properties, last_inspected_at, marker_type_id, material_type_id,
    condition_type_id, data_confidence, review_status, review_notes, updated_at
  )
  SELECT bruce_gravesite_uuid, headstone_id, 'headstone',
    E'ECKENDAHL\nBRUCE W.  1955 - 2025  HUSBAND\nTERRY M.  1958  WIFE\nTOGETHER FOREVER',
    'pink granite', ST_Y(marker_geometry), ST_X(marker_geometry), marker_geometry,
    jsonb_build_object(
      'Source', 'field photos', 'SourceFormat', 'Apple HEIC', 'Photos', photos,
      'CapturedAt', captured_at, 'DeviceMake', 'Apple', 'DeviceModel', 'iPhone 15 Pro',
      'CoordinateSource', 'midpoint interpolation from confirmed same-row adjacency',
      'RawExifGps', jsonb_build_object('latitude', exif_latitude, 'longitude', exif_longitude,
        'horizontalPositioningErrorMeters', exif_accuracy_meters),
      'AdjustedGeometry', jsonb_build_object('latitude', ST_Y(marker_geometry),
        'longitude', ST_X(marker_geometry),
        'reason', 'User confirmed the marker is between TLC-HS-0328 and TLC-HS-0329 in the same row.'),
      'NormalizedProvenance', jsonb_build_object('nhgInclusion', 'not_listed',
        'importedGravesiteSpreadsheetInclusion', 'not_listed',
        'verificationSourceType', 'field_photo', 'verifiedAt', '2026-08-11')
    ),
    DATE '2026-08-08', marker_type_id, material_type_id, condition_type_id,
    'medium', 'needs_review',
    'Field-photo identity and adjacency are strong; marker and grave geometry remain estimated pending survey.',
    now()
  FROM grave_context
  ON CONFLICT (headstone_id) DO UPDATE SET
    gravesite_uuid = EXCLUDED.gravesite_uuid, marker_type = EXCLUDED.marker_type,
    inscription = EXCLUDED.inscription, material = EXCLUDED.material,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, geometry = EXCLUDED.geometry,
    source_properties = EXCLUDED.source_properties, last_inspected_at = EXCLUDED.last_inspected_at,
    marker_type_id = EXCLUDED.marker_type_id, material_type_id = EXCLUDED.material_type_id,
    condition_type_id = EXCLUDED.condition_type_id, data_confidence = EXCLUDED.data_confidence,
    review_status = EXCLUDED.review_status, review_notes = EXCLUDED.review_notes,
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()
  RETURNING id
),
upserted_burials AS (
  INSERT INTO burials (
    gravesite_uuid, first_name, last_name, full_name, sex, veteran, notes, gravesite_id,
    interment_type_id, birth_date_text, death_date_text, burial_record_status_type_id, data_confidence,
    review_status, review_notes, source_properties, updated_at
  )
  SELECT bruce_gravesite_uuid, 'Bruce W', 'Eckendahl', 'Bruce W Eckendahl', 'Male', false,
    'Marker inscription reads 1955-2025. Added from 2026 field photos; not listed in the NHG or imported gravesite spreadsheet.',
    'TLC-GPS-0328-02', interment_type_id, '1955', '2025', interred_status_type_id, 'medium', 'needs_review',
    'Verify exact birth and death dates; casket is the required provisional interment type and remains unverified.',
    jsonb_build_object('Source', 'field photos', 'Photos', photos,
      'NormalizedProvenance', jsonb_build_object('nhgInclusion', 'not_listed',
        'importedGravesiteSpreadsheetInclusion', 'not_listed', 'verifiedAt', '2026-08-11')), now()
  FROM grave_context
  WHERE NOT EXISTS (SELECT 1 FROM burials WHERE deleted_at IS NULL
    AND lower(trim(COALESCE(full_name, ''))) = 'bruce w eckendahl')
  UNION ALL
  SELECT terry_gravesite_uuid, 'Terry M', 'Eckendahl', 'Terry M Eckendahl', 'Female', false,
    'Living person represented by a pre-need marker inscription showing birth year 1958.',
    'TLC-GPS-0328-03', interment_type_id, '1958', NULL, pre_need_status_type_id, 'medium', 'needs_review',
    'Pre-need inscription only; no death or interment is asserted. Casket is a required provisional type, not an observed interment.',
    jsonb_build_object('Source', 'field photos', 'Photos', photos,
      'NormalizedProvenance', jsonb_build_object('nhgInclusion', 'not_listed',
        'importedGravesiteSpreadsheetInclusion', 'not_listed', 'verifiedAt', '2026-08-11')), now()
  FROM grave_context
  WHERE NOT EXISTS (SELECT 1 FROM burials WHERE deleted_at IS NULL
    AND lower(trim(COALESCE(full_name, ''))) = 'terry m eckendahl')
  RETURNING id, full_name
),
burial_records AS (
  SELECT id, full_name FROM upserted_burials
  UNION ALL
  SELECT burials.id, burials.full_name FROM burials
  WHERE burials.deleted_at IS NULL
    AND lower(trim(COALESCE(burials.full_name, ''))) IN ('bruce w eckendahl', 'terry m eckendahl')
    AND NOT EXISTS (SELECT 1 FROM upserted_burials WHERE upserted_burials.id = burials.id)
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes, updated_at)
  SELECT upserted_headstone.id, grave_context.bruce_gravesite_uuid, 'spans',
    'Shared Eckendahl marker spans Bruce W and Terry M spaces.', now()
  FROM upserted_headstone CROSS JOIN grave_context
  UNION ALL
  SELECT upserted_headstone.id, grave_context.terry_gravesite_uuid, 'spans',
    'Shared Eckendahl marker spans Bruce W and Terry M spaces.', now()
  FROM upserted_headstone CROSS JOIN grave_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type, notes = EXCLUDED.notes,
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()
)
INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
SELECT upserted_headstone.id, burial_records.id
FROM upserted_headstone CROSS JOIN burial_records
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL;

--rollback empty
