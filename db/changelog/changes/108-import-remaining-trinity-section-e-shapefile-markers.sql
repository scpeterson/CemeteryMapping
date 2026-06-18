--liquibase formatted sql

--changeset cemeterymapping:108-import-remaining-trinity-section-e-shapefile-markers splitStatements:false
WITH source_markers (
  headstone_id,
  gravesite_id,
  grave_id,
  shapefile_feature_index,
  shapefile_title,
  longitude,
  latitude,
  nhg_section,
  nhg_row,
  nhg_site_id,
  first_name,
  last_name,
  birth_date,
  birth_date_text,
  death_date,
  death_date_text
) AS (
  VALUES
    ('TLC-HS-0574', 'TLC-GPS-0574', '0574', 297, '299', -80.08050443452221::numeric, 40.60171288179586::numeric, 'E', '6', '7', 'Heinrich', 'Brant', NULL, 'February 29, 1773', DATE '1849-02-14', 'February 14, 1849'),
    ('TLC-HS-0575', 'TLC-GPS-0575', '0575', 299, '301', -80.08051853451963::numeric, 40.60173010179628::numeric, 'E', '6', '9', 'Conrad', 'Brand', DATE '1862-02-25', 'February 25, 1862', DATE '1862-05-31', 'May 31, 1862')
),
inserted_headstones AS (
  INSERT INTO headstones (
    headstone_id,
    marker_type,
    marker_type_id,
    material_type_id,
    condition_type_id,
    latitude,
    longitude,
    geometry,
    source_properties,
    updated_at
  )
  SELECT
    source_markers.headstone_id,
    'headstone',
    marker_types.id,
    marker_material_types.id,
    headstone_condition_types.id,
    source_markers.latitude,
    source_markers.longitude,
    ST_SetSRID(
      ST_MakePoint(source_markers.longitude::double precision, source_markers.latitude::double precision),
      4326
    )::geometry(Point, 4326),
    jsonb_build_object(
      'Source', 'TrinityCemeteryFinal3.shp',
      'SourceFormat', 'ESRI Shapefile',
      'ImportReason', 'Recovered Section E marker present in original shapefile but still missing from reviewed marker mapping.',
      'ShapefileFeatureIndex', source_markers.shapefile_feature_index,
      'Title', source_markers.shapefile_title,
      'Latitude', source_markers.latitude,
      'Longitude', source_markers.longitude,
      'CoordinateSource', 'shapefile geometry',
      'NhgSection', source_markers.nhg_section,
      'NhgRow', source_markers.nhg_row,
      'Number', source_markers.nhg_site_id,
      'Person1First', source_markers.first_name,
      'Person1Last', source_markers.last_name,
      'Person1DOB', source_markers.birth_date_text,
      'Person1DOD', source_markers.death_date_text,
      'ShapefileGeometryUpdate', jsonb_build_object(
        'source', 'TrinityCemeteryFinal3.shp',
        'coordinateSource', 'shapefile geometry',
        'shapefileFeatureIndex', source_markers.shapefile_feature_index,
        'shapefileTitle', source_markers.shapefile_title,
        'shapefileName', NULLIF(concat_ws(' ', source_markers.first_name, source_markers.last_name), ''),
        'matchConfidence', 'recovered_missing_marker',
        'matchReasons', 'manual_review|missing_from_reviewed_mapping',
        'reviewedAt', '2026-06-18'
      )
    ),
    now()
  FROM source_markers
  JOIN marker_types
    ON marker_types.code = 'unknown'
  JOIN marker_material_types
    ON marker_material_types.code = 'unknown'
  JOIN headstone_condition_types
    ON headstone_condition_types.code = 'unknown'
  ON CONFLICT (headstone_id) DO UPDATE SET
    marker_type = EXCLUDED.marker_type,
    marker_type_id = EXCLUDED.marker_type_id,
    material_type_id = EXCLUDED.material_type_id,
    condition_type_id = EXCLUDED.condition_type_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geometry = EXCLUDED.geometry,
    source_properties = EXCLUDED.source_properties,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id, headstone_id
),
generated_geometries AS (
  SELECT
    source_markers.*,
    ST_SetSRID(
      ST_MakePoint(source_markers.longitude::double precision, source_markers.latitude::double precision),
      4326
    )::geometry(Point, 4326) AS marker_geometry,
    source_markers.longitude AS west_longitude,
    source_markers.longitude + ((10.0 * 0.3048) / (111320.0 * cos(radians(source_markers.latitude)))) AS east_longitude,
    source_markers.latitude - ((4.0 * 0.3048) / 2.0 / 111320.0) AS south_latitude,
    source_markers.latitude + ((4.0 * 0.3048) / 2.0 / 111320.0) AS north_latitude,
    NULLIF(concat_ws(' ', source_markers.first_name, source_markers.last_name), '') AS gravesite_name
  FROM source_markers
),
candidate_gravesites AS (
  SELECT
    generated_geometries.*,
    cemeteries.id AS cemetery_id,
    cemeteries.facility_id,
    sections.section_id AS section_uuid,
    COALESCE(sections.name, generated_geometries.nhg_section) AS section_id,
    ST_Multi(
      ST_MakeEnvelope(
        generated_geometries.west_longitude,
        generated_geometries.south_latitude,
        generated_geometries.east_longitude,
        generated_geometries.north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM generated_geometries
  JOIN LATERAL (
    SELECT cemeteries.id, cemeteries.facility_id
    FROM cemeteries
    WHERE cemeteries.deleted_at IS NULL
      AND ST_Covers(cemeteries.geometry, generated_geometries.marker_geometry)
    ORDER BY cemeteries.name, cemeteries.id
    LIMIT 1
  ) cemeteries ON true
  LEFT JOIN LATERAL (
    SELECT sections.section_id, sections.name
    FROM sections
    WHERE sections.deleted_at IS NULL
      AND sections.cemetery_id = cemeteries.id
      AND ST_Covers(sections.geometry, generated_geometries.marker_geometry)
    ORDER BY
      CASE WHEN sections.name = generated_geometries.nhg_section THEN 0 ELSE 1 END,
      sections.name,
      sections.section_id
    LIMIT 1
  ) sections ON true
),
inserted_gravesites AS (
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
    candidate_gravesites.cemetery_id,
    candidate_gravesites.section_uuid,
    candidate_gravesites.gravesite_name,
    candidate_gravesites.facility_id,
    candidate_gravesites.section_id,
    candidate_gravesites.grave_id,
    candidate_gravesites.gravesite_id,
    4,
    10,
    gravesite_status_types.id,
    candidate_gravesites.geometry,
    'operational',
    'Generated from recovered TrinityCemeteryFinal3.shp marker geometry.',
    'estimated',
    'Generated as a 4 ft x 10 ft operational gravesite with the 4 ft western edge centered on the recovered marker point and the 10 ft edges extending east.',
    now()
  FROM candidate_gravesites
  JOIN gravesite_status_types
    ON gravesite_status_types.code = 'occupied'
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
  RETURNING id, gravesite_id
),
updated_headstones AS (
  UPDATE headstones
  SET
    gravesite_uuid = inserted_gravesites.id,
    updated_at = now()
  FROM inserted_gravesites
  JOIN source_markers
    ON source_markers.gravesite_id = inserted_gravesites.gravesite_id
  WHERE headstones.deleted_at IS NULL
    AND headstones.headstone_id = source_markers.headstone_id
  RETURNING headstones.id AS headstone_uuid, inserted_gravesites.id AS gravesite_uuid, inserted_gravesites.gravesite_id
),
linked_headstones AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    notes,
    updated_at
  )
  SELECT
    updated_headstones.headstone_uuid,
    updated_headstones.gravesite_uuid,
    'primary',
    'Generated from recovered TrinityCemeteryFinal3.shp marker geometry.',
    now()
  FROM updated_headstones
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    notes = EXCLUDED.notes,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING headstone_uuid, gravesite_uuid
),
deleted_existing_burials AS (
  UPDATE burials
  SET
    deleted_at = now(),
    delete_reason = 'Replaced by recovered Section E shapefile marker import.',
    updated_at = now()
  WHERE id IN (
    SELECT headstone_burials.burial_uuid
    FROM headstone_burials
    JOIN updated_headstones
      ON updated_headstones.headstone_uuid = headstone_burials.headstone_uuid
    WHERE headstone_burials.deleted_at IS NULL
  )
  RETURNING id
),
deleted_existing_links AS (
  UPDATE headstone_burials
  SET
    deleted_at = now(),
    delete_reason = 'Replaced by recovered Section E shapefile marker import.'
  FROM updated_headstones
  WHERE headstone_burials.headstone_uuid = updated_headstones.headstone_uuid
    AND headstone_burials.deleted_at IS NULL
  RETURNING headstone_burials.headstone_uuid
),
inserted_burials AS (
  INSERT INTO burials (
    gravesite_uuid,
    first_name,
    last_name,
    full_name,
    birth_date,
    birth_date_text,
    death_date,
    death_date_text,
    gravesite_id,
    interment_type_id,
    notes,
    updated_at
  )
  SELECT
    updated_headstones.gravesite_uuid,
    source_markers.first_name,
    source_markers.last_name,
    NULLIF(concat_ws(' ', source_markers.first_name, source_markers.last_name), ''),
    source_markers.birth_date,
    source_markers.birth_date_text,
    source_markers.death_date,
    source_markers.death_date_text,
    updated_headstones.gravesite_id,
    burial_interment_types.id,
    concat(
      'Imported from TrinityCemeteryFinal3.shp feature ',
      source_markers.shapefile_feature_index,
      '. North Hills Genealogists section: ',
      COALESCE(source_markers.nhg_section, 'not recorded'),
      '. North Hills Genealogists row: ',
      COALESCE(source_markers.nhg_row, 'not recorded'),
      '. North Hills Genealogists site: ',
      COALESCE(source_markers.nhg_site_id, 'not recorded'),
      '. Person column: 1.'
    ),
    now()
  FROM source_markers
  JOIN updated_headstones
    ON replace(updated_headstones.gravesite_id, 'TLC-GPS-', 'TLC-HS-') = source_markers.headstone_id
  JOIN burial_interment_types
    ON burial_interment_types.code = 'casket'
  RETURNING id, notes
)
INSERT INTO headstone_burials (
  headstone_uuid,
  burial_uuid,
  deleted_at,
  deleted_by,
  delete_reason
)
SELECT
  updated_headstones.headstone_uuid,
  inserted_burials.id,
  NULL,
  NULL,
  NULL
FROM inserted_burials
JOIN source_markers
  ON inserted_burials.notes LIKE concat(
    'Imported from TrinityCemeteryFinal3.shp feature ',
    source_markers.shapefile_feature_index,
    '.%'
  )
JOIN updated_headstones
  ON replace(updated_headstones.gravesite_id, 'TLC-GPS-', 'TLC-HS-') = source_markers.headstone_id
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback DELETE FROM burials WHERE id IN (SELECT headstone_burials.burial_uuid FROM headstone_burials JOIN headstones ON headstones.id = headstone_burials.headstone_uuid WHERE headstones.headstone_id IN ('TLC-HS-0574', 'TLC-HS-0575'));
--rollback DELETE FROM headstone_gravesites WHERE gravesite_uuid IN (SELECT id FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0574', 'TLC-GPS-0575'));
--rollback UPDATE headstones SET gravesite_uuid = NULL, updated_at = now() WHERE headstone_id IN ('TLC-HS-0574', 'TLC-HS-0575');
--rollback DELETE FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0574', 'TLC-GPS-0575');
--rollback DELETE FROM headstones WHERE headstone_id IN ('TLC-HS-0574', 'TLC-HS-0575');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('burials', 'headstone_burials', 'headstone_gravesites', 'gravesites', 'headstones');
