--liquibase formatted sql

--changeset cemeterymapping:261-add-colleen-hirschey-field-photo-marker splitStatements:false
WITH source AS (
  SELECT
    'TLC-HS-0274B'::varchar AS headstone_id,
    'TLC-GPS-0274-02'::varchar AS gravesite_id,
    '0274B'::varchar AS grave_id,
    'Colleen Derstine Hirschey'::varchar AS full_name,
    'Colleen'::varchar AS first_name,
    'Derstine'::varchar AS maiden_name,
    'Hirschey'::varchar AS last_name,
    DATE '1959-07-12' AS birth_date,
    DATE '2020-02-20' AS death_date,
    40.60131944444445::numeric AS exif_latitude,
    -80.08033055555555::numeric AS exif_longitude,
    2.8191404695582967::numeric AS exif_accuracy_meters,
    40.60129714569545::numeric AS adjusted_latitude,
    -80.08033564456416::numeric AS adjusted_longitude,
    TIMESTAMPTZ '2026-06-15 20:16:31-04:00' AS captured_at,
    'IMG_5350.HEIC'::varchar AS original_filename,
    '0e05726c0a3d9d0a50fa3c97243a4ade40b3dc121ba24f297dccf0ca692e0829'::varchar AS sha256
),
context AS (
  SELECT
    source.*,
    cemeteries.id AS cemetery_id,
    cemeteries.facility_id,
    sections.section_id AS section_uuid,
    sections.name AS section_id,
    gravesite_status_types.id AS status_type_id,
    marker_types.id AS marker_type_id,
    marker_material_types.id AS material_type_id,
    headstone_condition_types.id AS condition_type_id,
    burial_interment_types.id AS interment_type_id,
    burial_record_status_types.id AS burial_record_status_type_id,
    ST_SetSRID(
      ST_MakePoint(
        source.adjusted_longitude::double precision,
        source.adjusted_latitude::double precision
      ),
      4326
    )::geometry(Point, 4326) AS marker_geometry
  FROM source
  JOIN cemeteries
    ON cemeteries.facility_id = '1'
   AND cemeteries.deleted_at IS NULL
  JOIN sections
    ON sections.cemetery_id = cemeteries.id
   AND upper(sections.name) = 'C'
   AND sections.deleted_at IS NULL
  JOIN gravesite_status_types
    ON gravesite_status_types.code = 'occupied'
  JOIN marker_types
    ON marker_types.code = 'bevel_marker'
  JOIN marker_material_types
    ON marker_material_types.code = 'gray_granite'
  JOIN headstone_condition_types
    ON headstone_condition_types.code = 'good'
  JOIN burial_interment_types
    ON burial_interment_types.code = 'casket'
  JOIN burial_record_status_types
    ON burial_record_status_types.code = 'interred'
  LIMIT 1
),
candidate AS (
  SELECT
    context.*,
    ST_Project(context.marker_geometry::geography, 0.35, 3 * pi() / 2)::geometry AS west_center
  FROM context
),
candidate_geometry AS (
  SELECT
    candidate.*,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            ST_Project(west_center::geography, 2 * 0.3048, pi())::geometry,
            ST_Project(
              ST_Project(west_center::geography, 2 * 0.3048, pi()),
              10 * 0.3048,
              pi() / 2
            )::geometry,
            ST_Project(
              ST_Project(west_center::geography, 2 * 0.3048, 0),
              10 * 0.3048,
              pi() / 2
            )::geometry,
            ST_Project(west_center::geography, 2 * 0.3048, 0)::geometry,
            ST_Project(west_center::geography, 2 * 0.3048, pi())::geometry
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS gravesite_geometry
  FROM candidate
),
upserted_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id,
    section_uuid,
    name,
    facility_id,
    section_id,
    grave_id,
    gravesite_id,
    width_feet,
    length_feet,
    status_type_id,
    geometry,
    geometry_type,
    geometry_source,
    geometry_confidence,
    geometry_notes,
    updated_at
  )
  SELECT
    cemetery_id,
    section_uuid,
    full_name,
    facility_id,
    section_id,
    grave_id,
    gravesite_id,
    4.00,
    10.00,
    status_type_id,
    gravesite_geometry,
    'operational',
    'Estimated from field photo IMG_5350.HEIC, iPhone EXIF GPS, and the mapped gap between C-0274A and C-0276.',
    'estimated',
    'Placed north of C-0274A and south of C-0276. The marker uses the center of the mapped gap; the gravesite polygon starts 0.35 m west of the marker to avoid overlap with estimated C-0252 and C-0253 geometry. Raw iPhone GPS reported approximately 2.82 m horizontal uncertainty.',
    now()
  FROM candidate_geometry
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    section_uuid = EXCLUDED.section_uuid,
    name = EXCLUDED.name,
    facility_id = EXCLUDED.facility_id,
    section_id = EXCLUDED.section_id,
    grave_id = EXCLUDED.grave_id,
    width_feet = EXCLUDED.width_feet,
    length_feet = EXCLUDED.length_feet,
    status_type_id = EXCLUDED.status_type_id,
    geometry = EXCLUDED.geometry,
    geometry_type = EXCLUDED.geometry_type,
    geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence,
    geometry_notes = EXCLUDED.geometry_notes,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id
),
upserted_headstone AS (
  INSERT INTO headstones (
    gravesite_uuid,
    headstone_id,
    marker_type,
    inscription,
    material,
    latitude,
    longitude,
    geometry,
    source_properties,
    last_inspected_at,
    marker_type_id,
    material_type_id,
    condition_type_id,
    data_confidence,
    review_status,
    review_notes,
    updated_at
  )
  SELECT
    upserted_gravesite.id,
    candidate_geometry.headstone_id,
    'headstone',
    E'COLLEEN DERSTINE\nHIRSCHEY\nJULY 12, 1959\nFEB. 20, 2020',
    'gray granite',
    candidate_geometry.adjusted_latitude,
    candidate_geometry.adjusted_longitude,
    candidate_geometry.marker_geometry,
    jsonb_build_object(
      'Source', 'field photo',
      'SourceFormat', 'Apple HEIC',
      'OriginalFilename', candidate_geometry.original_filename,
      'Sha256', candidate_geometry.sha256,
      'CapturedAt', candidate_geometry.captured_at,
      'DeviceMake', 'Apple',
      'DeviceModel', 'iPhone 15 Pro',
      'CoordinateSource', 'gap-centered placement informed by iPhone EXIF GPS',
      'RawExifGps', jsonb_build_object(
        'latitude', candidate_geometry.exif_latitude,
        'longitude', candidate_geometry.exif_longitude,
        'horizontalPositioningErrorMeters', candidate_geometry.exif_accuracy_meters
      ),
      'AdjustedGeometry', jsonb_build_object(
        'latitude', candidate_geometry.adjusted_latitude,
        'longitude', candidate_geometry.adjusted_longitude,
        'reason', 'Centered in the mapped north/south gap between C-0274A and C-0276 and aligned to their marker row.'
      ),
      'NormalizedProvenance', jsonb_build_object(
        'nhgInclusion', 'not_listed',
        'verificationSourceType', 'manual_review',
        'verifiedAt', '2026-07-25'
      )
    ),
    DATE '2026-06-15',
    candidate_geometry.marker_type_id,
    candidate_geometry.material_type_id,
    candidate_geometry.condition_type_id,
    'medium',
    'needs_review',
    'Estimated marker location derived from mapped adjacency and consumer-device GPS; verify by survey or field measurement when practical.',
    now()
  FROM candidate_geometry
  CROSS JOIN upserted_gravesite
  ON CONFLICT (headstone_id) DO UPDATE SET
    gravesite_uuid = EXCLUDED.gravesite_uuid,
    marker_type = EXCLUDED.marker_type,
    inscription = EXCLUDED.inscription,
    material = EXCLUDED.material,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geometry = EXCLUDED.geometry,
    source_properties = EXCLUDED.source_properties,
    last_inspected_at = EXCLUDED.last_inspected_at,
    marker_type_id = EXCLUDED.marker_type_id,
    material_type_id = EXCLUDED.material_type_id,
    condition_type_id = EXCLUDED.condition_type_id,
    data_confidence = EXCLUDED.data_confidence,
    review_status = EXCLUDED.review_status,
    review_notes = EXCLUDED.review_notes,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id
),
upserted_burial AS (
  INSERT INTO burials (
    gravesite_uuid,
    first_name,
    last_name,
    full_name,
    maiden_name,
    sex,
    birth_date,
    death_date,
    veteran,
    notes,
    gravesite_id,
    interment_type_id,
    birth_date_text,
    death_date_text,
    burial_record_status_type_id,
    data_confidence,
    review_status,
    review_notes,
    source_properties,
    updated_at
  )
  SELECT
    upserted_gravesite.id,
    candidate_geometry.first_name,
    candidate_geometry.last_name,
    candidate_geometry.full_name,
    candidate_geometry.maiden_name,
    'Female',
    candidate_geometry.birth_date,
    candidate_geometry.death_date,
    'No',
    'Name and dates transcribed from field photo IMG_5350.HEIC. No matching NHG or headstone spreadsheet record; death occurred after both source updates.',
    candidate_geometry.gravesite_id,
    candidate_geometry.interment_type_id,
    'July 12, 1959',
    'February 20, 2020',
    candidate_geometry.burial_record_status_type_id,
    'medium',
    'needs_review',
    'Verify official burial record and casket interment type; identity and dates are supported by the photographed marker.',
    jsonb_build_object(
      'Source', 'field photo',
      'OriginalFilename', candidate_geometry.original_filename,
      'Sha256', candidate_geometry.sha256,
      'NormalizedProvenance', jsonb_build_object(
        'nhgInclusion', 'not_listed',
        'burialIdentitySource', 'field photo IMG_5350.HEIC',
        'verificationSourceType', 'manual_review',
        'verifiedAt', '2026-07-25'
      )
    ),
    now()
  FROM candidate_geometry
  CROSS JOIN upserted_gravesite
  WHERE NOT EXISTS (
    SELECT 1
    FROM burials
    WHERE burials.deleted_at IS NULL
      AND lower(trim(COALESCE(burials.first_name, ''))) = 'colleen'
      AND lower(trim(COALESCE(burials.last_name, ''))) = 'hirschey'
      AND lower(trim(COALESCE(burials.maiden_name, ''))) = 'derstine'
      AND burials.birth_date = DATE '1959-07-12'
      AND burials.death_date = DATE '2020-02-20'
  )
  RETURNING id
),
burial_record AS (
  SELECT id FROM upserted_burial
  UNION ALL
  SELECT burials.id
  FROM burials
  JOIN candidate_geometry
    ON lower(trim(COALESCE(burials.first_name, ''))) = 'colleen'
   AND lower(trim(COALESCE(burials.last_name, ''))) = 'hirschey'
   AND lower(trim(COALESCE(burials.maiden_name, ''))) = 'derstine'
   AND burials.birth_date = candidate_geometry.birth_date
   AND burials.death_date = candidate_geometry.death_date
  WHERE burials.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM upserted_burial)
  LIMIT 1
),
marker_gravesite_link AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    notes,
    updated_at
  )
  SELECT
    upserted_headstone.id,
    upserted_gravesite.id,
    'primary',
    'Colleen Derstine Hirschey marker and estimated gravesite created from 2026 field-photo evidence.',
    now()
  FROM upserted_headstone
  CROSS JOIN upserted_gravesite
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    notes = EXCLUDED.notes,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id
)
INSERT INTO headstone_burials (
  headstone_uuid,
  burial_uuid
)
SELECT
  upserted_headstone.id,
  burial_record.id
FROM upserted_headstone
CROSS JOIN burial_record
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback empty
