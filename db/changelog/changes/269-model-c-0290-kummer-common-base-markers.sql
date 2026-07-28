--liquibase formatted sql

--changeset cemeterymapping:269-model-c-0290-kummer-common-base-markers splitStatements:false
WITH marker_context AS (
  SELECT
    dora_grave.id AS dora_gravesite_uuid,
    christ_grave.id AS christ_gravesite_uuid,
    dora_marker.id AS dora_marker_uuid,
    ST_SetSRID(dora_marker.geometry, 4326) AS shared_gps_point,
    dora_marker.source_properties AS original_source_properties,
    marker_types.id AS upright_marker_type_id,
    marker_material_types.id AS gray_granite_material_id,
    headstone_condition_types.id AS excellent_condition_id,
    marker_scope_types.id AS single_scope_id
  FROM gravesites dora_grave
  JOIN gravesites christ_grave
    ON christ_grave.cemetery_id = dora_grave.cemetery_id
   AND christ_grave.gravesite_id = 'TLC-GPS-0290-01'
   AND christ_grave.deleted_at IS NULL
  JOIN headstones dora_marker
    ON dora_marker.headstone_id = 'TLC-HS-0290'
   AND dora_marker.deleted_at IS NULL
  JOIN marker_types
    ON marker_types.code = 'upright_headstone'
  JOIN marker_material_types
    ON marker_material_types.code = 'gray_granite'
  JOIN headstone_condition_types
    ON headstone_condition_types.code = 'excellent'
  JOIN marker_scope_types
    ON marker_scope_types.code = 'single'
  WHERE dora_grave.gravesite_id = 'TLC-GPS-0290'
    AND dora_grave.deleted_at IS NULL
  LIMIT 1
),
derived_marker_points AS (
  SELECT
    marker_context.*,
    ST_Project(shared_gps_point::geography, 2 * 0.3048, pi())::geometry(Point, 4326) AS dora_marker_point,
    ST_Project(shared_gps_point::geography, 2 * 0.3048, 0)::geometry(Point, 4326) AS christ_marker_point
  FROM marker_context
),
updated_dora_marker AS (
  UPDATE headstones
  SET
    gravesite_uuid = derived_marker_points.dora_gravesite_uuid,
    marker_type = 'headstone',
    marker_type_id = derived_marker_points.upright_marker_type_id,
    marker_scope_type_id = derived_marker_points.single_scope_id,
    material = 'gray granite',
    material_type_id = derived_marker_points.gray_granite_material_id,
    condition_type_id = derived_marker_points.excellent_condition_id,
    inscription = E'Dora Kummer\n1826-1926',
    latitude = ST_Y(derived_marker_points.dora_marker_point),
    longitude = ST_X(derived_marker_points.dora_marker_point),
    geometry = derived_marker_points.dora_marker_point,
    data_confidence = 'medium',
    review_status = 'reviewed',
    review_notes = 'Individual marker point estimated two feet south of the shared structure GPS coordinate. Dora and Christ Kummer have separate upright stones on one common base.',
    source_properties = COALESCE(derived_marker_points.original_source_properties, '{}'::jsonb) || jsonb_build_object(
      'SharedCommonBase', jsonb_build_object(
        'sharedGpsLatitude', ST_Y(derived_marker_points.shared_gps_point),
        'sharedGpsLongitude', ST_X(derived_marker_points.shared_gps_point),
        'individualPointMethod', 'Derived two feet south from one GPS coordinate for the two-stone common-base structure.',
        'fieldPhotoFilename', 'E6095FF6-34DD-4DB5-882E-42260D905B07_1_105_c.jpeg',
        'fieldPhotoObservation', 'Two separate upright gray-granite markers for Dora and Christ Kummer share one common base.',
        'reviewedAt', '2026-07-28'
      ),
      'NormalizedProvenance', jsonb_build_object(
        'nhgInclusion', 'listed',
        'verificationSourceType', 'field_observation',
        'verifiedAt', '2026-07-28'
      )
    ),
    updated_at = now()
  FROM derived_marker_points
  WHERE headstones.id = derived_marker_points.dora_marker_uuid
  RETURNING headstones.id
),
christ_marker AS (
  INSERT INTO headstones (
    gravesite_uuid,
    headstone_id,
    marker_type,
    marker_type_id,
    marker_scope_type_id,
    material,
    material_type_id,
    condition_type_id,
    inscription,
    latitude,
    longitude,
    geometry,
    data_confidence,
    review_status,
    review_notes,
    source_properties,
    updated_at
  )
  SELECT
    derived_marker_points.christ_gravesite_uuid,
    'TLC-HS-0290A',
    'headstone',
    derived_marker_points.upright_marker_type_id,
    derived_marker_points.single_scope_id,
    'gray granite',
    derived_marker_points.gray_granite_material_id,
    derived_marker_points.excellent_condition_id,
    E'Christ Kummer\n1827-1895',
    ST_Y(derived_marker_points.christ_marker_point),
    ST_X(derived_marker_points.christ_marker_point),
    derived_marker_points.christ_marker_point,
    'medium',
    'reviewed',
    'Individual marker point estimated two feet north of the shared structure GPS coordinate. Dora and Christ Kummer have separate upright stones on one common base.',
    jsonb_build_object(
      'Source', 'NHG reading and field photo',
      'CoordinateSource', 'Derived from shared structure GPS coordinate',
      'SharedCommonBase', jsonb_build_object(
        'sharedGpsLatitude', ST_Y(derived_marker_points.shared_gps_point),
        'sharedGpsLongitude', ST_X(derived_marker_points.shared_gps_point),
        'individualPointMethod', 'Derived two feet north from one GPS coordinate for the two-stone common-base structure.',
        'fieldPhotoFilename', 'E6095FF6-34DD-4DB5-882E-42260D905B07_1_105_c.jpeg',
        'fieldPhotoObservation', 'Two separate upright gray-granite markers for Dora and Christ Kummer share one common base.',
        'reviewedAt', '2026-07-28'
      ),
      'NormalizedProvenance', jsonb_build_object(
        'nhgInclusion', 'listed',
        'verificationSourceType', 'field_observation',
        'verifiedAt', '2026-07-28'
      )
    ),
    now()
  FROM derived_marker_points
  CROSS JOIN updated_dora_marker
  ON CONFLICT (headstone_id) DO UPDATE SET
    gravesite_uuid = EXCLUDED.gravesite_uuid,
    marker_type = EXCLUDED.marker_type,
    marker_type_id = EXCLUDED.marker_type_id,
    marker_scope_type_id = EXCLUDED.marker_scope_type_id,
    material = EXCLUDED.material,
    material_type_id = EXCLUDED.material_type_id,
    condition_type_id = EXCLUDED.condition_type_id,
    inscription = EXCLUDED.inscription,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geometry = EXCLUDED.geometry,
    data_confidence = EXCLUDED.data_confidence,
    review_status = EXCLUDED.review_status,
    review_notes = EXCLUDED.review_notes,
    source_properties = EXCLUDED.source_properties,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id
),
burial_context AS (
  SELECT
    derived_marker_points.dora_marker_uuid,
    christ_marker.id AS christ_marker_uuid,
    derived_marker_points.dora_gravesite_uuid,
    derived_marker_points.christ_gravesite_uuid,
    max(burials.id::text) FILTER (WHERE lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) = 'dora')::uuid AS dora_burial_uuid,
    max(burials.id::text) FILTER (WHERE lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) = 'christ')::uuid AS christ_burial_uuid
  FROM derived_marker_points
  CROSS JOIN christ_marker
  JOIN burials
    ON burials.gravesite_uuid IN (
      derived_marker_points.dora_gravesite_uuid,
      derived_marker_points.christ_gravesite_uuid
    )
   AND burials.deleted_at IS NULL
   AND lower(COALESCE(burials.last_name, '')) = 'kummer'
  GROUP BY
    derived_marker_points.dora_marker_uuid,
    christ_marker.id,
    derived_marker_points.dora_gravesite_uuid,
    derived_marker_points.christ_gravesite_uuid
),
retired_dora_christ_burial_link AS (
  UPDATE headstone_burials
  SET
    deleted_at = now(),
    delete_reason = 'Christ Kummer is represented by separate marker TLC-HS-0290A on the shared common base.'
  FROM burial_context
  WHERE headstone_burials.headstone_uuid = burial_context.dora_marker_uuid
    AND headstone_burials.burial_uuid = burial_context.christ_burial_uuid
    AND headstone_burials.deleted_at IS NULL
  RETURNING headstone_burials.headstone_uuid, headstone_burials.burial_uuid
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT dora_marker_uuid, dora_burial_uuid FROM burial_context
  UNION ALL
  SELECT christ_marker_uuid, christ_burial_uuid FROM burial_context
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
),
retired_dora_christ_gravesite_link AS (
  UPDATE headstone_gravesites
  SET
    deleted_at = now(),
    delete_reason = 'Christ Kummer gravesite is represented by separate marker TLC-HS-0290A on the shared common base.'
  FROM burial_context
  WHERE headstone_gravesites.headstone_uuid = burial_context.dora_marker_uuid
    AND headstone_gravesites.gravesite_uuid = burial_context.christ_gravesite_uuid
    AND headstone_gravesites.deleted_at IS NULL
  RETURNING headstone_gravesites.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes, updated_at)
  SELECT dora_marker_uuid, dora_gravesite_uuid, 'primary', 'Dora Kummer upright marker on shared common base.', now()
  FROM burial_context
  UNION ALL
  SELECT christ_marker_uuid, christ_gravesite_uuid, 'primary', 'Christ Kummer upright marker on shared common base.', now()
  FROM burial_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    notes = EXCLUDED.notes,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
common_base_relationship AS (
  INSERT INTO headstone_relationships (
    from_headstone_uuid,
    to_headstone_uuid,
    relationship_type,
    source_type,
    source_text,
    confidence,
    notes,
    status,
    updated_at
  )
  SELECT
    dora_marker_uuid,
    christ_marker_uuid,
    'common_base',
    'nhg',
    'NHG positions (8C, 10, s) and (8C, 11, s) each state that the two Kummer upright markers are on a common base.',
    'high',
    'Field photograph confirms two separate upright markers sharing one stone base; one GPS coordinate documents the complete structure.',
    'active',
    now()
  FROM burial_context
  ON CONFLICT (from_headstone_uuid, to_headstone_uuid, relationship_type) WHERE deleted_at IS NULL
  DO UPDATE SET
    source_type = EXCLUDED.source_type,
    source_text = EXCLUDED.source_text,
    confidence = EXCLUDED.confidence,
    notes = EXCLUDED.notes,
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING id
),
nhg_headstone_links AS (
  INSERT INTO north_hills_ocr_entry_headstone_links (
    entry_id,
    headstone_uuid,
    status,
    confidence,
    notes,
    reviewed_by_external_subject,
    reviewed_by_email,
    reviewed_at,
    updated_at
  )
  SELECT
    entries.id,
    CASE entries.parsed_position_number
      WHEN 10 THEN burial_context.dora_marker_uuid
      WHEN 11 THEN burial_context.christ_marker_uuid
    END,
    'linked',
    'high',
    'Linked by migration from the reviewed NHG common-base Kummer entries and field photograph.',
    'migration:269-model-c-0290-kummer-common-base-markers',
    'migration@cemeterymapping.local',
    now(),
    now()
  FROM north_hills_ocr_entries entries
  CROSS JOIN burial_context
  WHERE entries.parsed_section_name = 'C'
    AND entries.parsed_row_number = 8
    AND entries.parsed_position_number IN (10, 11)
    AND entries.raw_text ILIKE '%Kummer%'
  ON CONFLICT (entry_id, headstone_uuid) DO UPDATE SET
    status = 'linked',
    confidence = 'high',
    notes = EXCLUDED.notes,
    reviewed_by_external_subject = EXCLUDED.reviewed_by_external_subject,
    reviewed_by_email = EXCLUDED.reviewed_by_email,
    reviewed_at = now(),
    updated_at = now()
  RETURNING entry_id, headstone_uuid
),
nhg_gravesite_links AS (
  INSERT INTO north_hills_ocr_entry_gravesite_links (
    entry_id,
    gravesite_uuid,
    status,
    confidence,
    notes,
    reviewed_by_external_subject,
    reviewed_by_email,
    reviewed_at,
    updated_at
  )
  SELECT
    entries.id,
    CASE entries.parsed_position_number
      WHEN 10 THEN burial_context.dora_gravesite_uuid
      WHEN 11 THEN burial_context.christ_gravesite_uuid
    END,
    'linked',
    'high',
    'Linked by migration from the reviewed NHG common-base Kummer entries and field photograph.',
    'migration:269-model-c-0290-kummer-common-base-markers',
    'migration@cemeterymapping.local',
    now(),
    now()
  FROM north_hills_ocr_entries entries
  CROSS JOIN burial_context
  WHERE entries.parsed_section_name = 'C'
    AND entries.parsed_row_number = 8
    AND entries.parsed_position_number IN (10, 11)
    AND entries.raw_text ILIKE '%Kummer%'
  ON CONFLICT (entry_id, gravesite_uuid) DO UPDATE SET
    status = 'linked',
    confidence = 'high',
    notes = EXCLUDED.notes,
    reviewed_by_external_subject = EXCLUDED.reviewed_by_external_subject,
    reviewed_by_email = EXCLUDED.reviewed_by_email,
    reviewed_at = now(),
    updated_at = now()
  RETURNING entry_id, gravesite_uuid
),
shared_media_links AS (
  INSERT INTO headstone_media_assets (
    media_asset_id,
    headstone_uuid,
    relationship_type,
    status,
    notes,
    linked_by_external_subject,
    linked_by_email,
    linked_at,
    updated_at
  )
  SELECT
    existing_link.media_asset_id,
    burial_context.christ_marker_uuid,
    'context',
    'linked',
    'Shared field photograph documents both Kummer upright markers and their common base.',
    'migration:269-model-c-0290-kummer-common-base-markers',
    'migration@cemeterymapping.local',
    now(),
    now()
  FROM headstone_media_assets existing_link
  CROSS JOIN burial_context
  WHERE existing_link.headstone_uuid = burial_context.dora_marker_uuid
    AND existing_link.deleted_at IS NULL
    AND existing_link.status = 'linked'
  ON CONFLICT (media_asset_id, headstone_uuid) DO UPDATE SET
    relationship_type = 'context',
    status = 'linked',
    notes = EXCLUDED.notes,
    linked_by_external_subject = EXCLUDED.linked_by_external_subject,
    linked_by_email = EXCLUDED.linked_by_email,
    linked_at = now(),
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING media_asset_id, headstone_uuid
)
UPDATE headstones
SET updated_at = now()
FROM burial_context
WHERE headstones.id IN (burial_context.dora_marker_uuid, burial_context.christ_marker_uuid);

--rollback empty
