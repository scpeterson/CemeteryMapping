--liquibase formatted sql

--changeset cemeterymapping:257-add-gail-braun-field-photo-marker splitStatements:false
WITH source AS (
  SELECT
    'TLC-HS-0267A'::varchar AS headstone_id,
    'TLC-GPS-0267-01'::varchar AS gravesite_id,
    '0267A'::varchar AS grave_id,
    'Gail A Braun'::varchar AS full_name,
    'Gail A'::varchar AS first_name,
    'Braun'::varchar AS last_name,
    DATE '1947-04-15' AS birth_date,
    DATE '2025-03-17' AS death_date,
    40.60118888888889::numeric AS exif_latitude,
    -80.08032222222222::numeric AS exif_longitude,
    4.96947230702137::numeric AS exif_accuracy_meters,
    40.60118772678968::numeric AS adjusted_latitude,
    -80.08033409456999::numeric AS adjusted_longitude,
    TIMESTAMPTZ '2026-06-15 20:15:36-04:00' AS captured_at,
    'IMG_5342.HEIC'::varchar AS original_filename,
    '5002589c18a03e3787c4bfca0d14147df97b2acae8fc29b590c2bd8492e71a9a'::varchar AS sha256
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
    ON marker_types.code = 'upright_headstone'
  JOIN marker_material_types
    ON marker_material_types.code = 'gray_granite'
  JOIN headstone_condition_types
    ON headstone_condition_types.code = 'excellent'
  JOIN burial_interment_types
    ON burial_interment_types.code = 'casket'
  JOIN burial_record_status_types
    ON burial_record_status_types.code = 'interred'
  LIMIT 1
),
candidate AS (
  SELECT
    context.*,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            ST_Project(context.marker_geometry::geography, 2 * 0.3048, pi())::geometry,
            ST_Project(
              ST_Project(context.marker_geometry::geography, 2 * 0.3048, pi()),
              10 * 0.3048,
              pi() / 2
            )::geometry,
            ST_Project(
              ST_Project(context.marker_geometry::geography, 2 * 0.3048, 0),
              10 * 0.3048,
              pi() / 2
            )::geometry,
            ST_Project(context.marker_geometry::geography, 2 * 0.3048, 0)::geometry,
            ST_Project(context.marker_geometry::geography, 2 * 0.3048, pi())::geometry
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS gravesite_geometry
  FROM context
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
    'Estimated from field photo IMG_5342.HEIC, iPhone EXIF GPS, and interpolation between TLC-HS-0267 and TLC-HS-0268.',
    'estimated',
    'Placed between C-0267 (Alice N Matters) and C-0268 (George R Dunbar). The displayed geometry uses the marker-row midpoint; raw iPhone GPS reported approximately 4.97 m horizontal uncertainty.',
    now()
  FROM candidate
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
    candidate.headstone_id,
    'headstone',
    E'GAIL A. BRAUN\nAPRIL 15, 1947\nMARCH 17, 2025',
    'gray granite',
    candidate.adjusted_latitude,
    candidate.adjusted_longitude,
    candidate.marker_geometry,
    jsonb_build_object(
      'Source', 'field photo',
      'SourceFormat', 'Apple HEIC',
      'OriginalFilename', candidate.original_filename,
      'Sha256', candidate.sha256,
      'CapturedAt', candidate.captured_at,
      'DeviceMake', 'Apple',
      'DeviceModel', 'iPhone 15 Pro',
      'CoordinateSource', 'row-aligned interpolation informed by iPhone EXIF GPS and visible adjacency',
      'RawExifGps', jsonb_build_object(
        'latitude', candidate.exif_latitude,
        'longitude', candidate.exif_longitude,
        'horizontalPositioningErrorMeters', candidate.exif_accuracy_meters
      ),
      'AdjustedGeometry', jsonb_build_object(
        'latitude', candidate.adjusted_latitude,
        'longitude', candidate.adjusted_longitude,
        'reason', 'Aligned to midpoint of TLC-HS-0267 and TLC-HS-0268; photo shows north edge of Alice N Matters marker at left.'
      ),
      'NormalizedProvenance', jsonb_build_object(
        'nhgInclusion', 'not_listed',
        'verificationSourceType', 'field_photo',
        'verifiedAt', '2026-07-25'
      )
    ),
    DATE '2026-06-15',
    candidate.marker_type_id,
    candidate.material_type_id,
    candidate.condition_type_id,
    'medium',
    'needs_review',
    'Estimated marker location derived from field-photo adjacency and consumer-device GPS; verify by survey or field measurement when practical.',
    now()
  FROM candidate
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
    candidate.first_name,
    candidate.last_name,
    candidate.full_name,
    'Female',
    candidate.birth_date,
    candidate.death_date,
    'No',
    'Name and dates transcribed from field photo IMG_5342.HEIC. No matching NHG or headstone spreadsheet record; death occurred after both source updates.',
    candidate.gravesite_id,
    candidate.interment_type_id,
    'April 15, 1947',
    'March 17, 2025',
    candidate.burial_record_status_type_id,
    'medium',
    'needs_review',
    'Verify official burial record and casket interment type; identity and dates are supported by the photographed marker.',
    jsonb_build_object(
      'Source', 'field photo',
      'OriginalFilename', candidate.original_filename,
      'Sha256', candidate.sha256,
      'NormalizedProvenance', jsonb_build_object(
        'nhgInclusion', 'not_listed',
        'burialIdentitySource', 'field photo IMG_5342.HEIC',
        'verificationSourceType', 'field_photo',
        'verifiedAt', '2026-07-25'
      )
    ),
    now()
  FROM candidate
  CROSS JOIN upserted_gravesite
  WHERE NOT EXISTS (
    SELECT 1
    FROM burials
    WHERE burials.deleted_at IS NULL
      AND lower(trim(COALESCE(burials.first_name, ''))) = 'gail a'
      AND lower(trim(COALESCE(burials.last_name, ''))) = 'braun'
      AND burials.birth_date = DATE '1947-04-15'
      AND burials.death_date = DATE '2025-03-17'
  )
  RETURNING id
),
burial_record AS (
  SELECT id FROM upserted_burial
  UNION ALL
  SELECT burials.id
  FROM burials
  JOIN candidate
    ON lower(trim(COALESCE(burials.first_name, ''))) = 'gail a'
   AND lower(trim(COALESCE(burials.last_name, ''))) = 'braun'
   AND burials.birth_date = candidate.birth_date
   AND burials.death_date = candidate.death_date
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
    'Gail A Braun marker and estimated gravesite created from 2026 field-photo evidence.',
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
