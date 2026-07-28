--liquibase formatted sql

--changeset cemeterymapping:267-split-c-0289-kummer-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS marker_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0289'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.gravesite_id = 'TLC-GPS-0289'
    AND gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
geometry_points AS (
  SELECT
    source_record.*,
    ST_Project(marker_point::geography, 6 * 0.3048, 0)::geometry AS north_outer,
    ST_Project(marker_point::geography, 2 * 0.3048, 0)::geometry AS north_inner,
    ST_Project(marker_point::geography, 2 * 0.3048, pi())::geometry AS south_inner,
    ST_Project(marker_point::geography, 6 * 0.3048, pi())::geometry AS south_outer
  FROM source_record
),
replacement_geometries AS (
  SELECT
    geometry_points.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      north_inner,
      ST_Project(north_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_outer::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_outer,
      north_inner
    ])), 4326))::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_inner,
      ST_Project(south_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_inner,
      south_inner
    ])), 4326))::geometry(MultiPolygon, 4326) AS center_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_outer,
      ST_Project(south_outer::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(south_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      south_inner,
      south_outer
    ])), 4326))::geometry(MultiPolygon, 4326) AS south_geometry
  FROM geometry_points
),
margaret_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Margaret E Kummer',
    geometry = replacement_geometries.center_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Three-way split from TLC-GPS-0289 using fixed marker TLC-HS-0289.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Margaret E Kummer retained in original center gravesite C-0289 when the shared Kummer marker was split into three gravesites on 2026-07-28.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING
    gravesites.*,
    replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry,
    replacement_geometries.south_geometry
),
chester_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    name,
    facility_id,
    section_id,
    block_id,
    lot_id,
    grave_id,
    gravesite_id,
    cost,
    geometry,
    width_feet,
    length_feet,
    status_type_id,
    geometry_type,
    geometry_source,
    geometry_confidence,
    geometry_notes,
    updated_at
  )
  SELECT
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    'Chester T Kummer',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0289A',
    'TLC-GPS-0289-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Three-way split from TLC-GPS-0289 using fixed marker TLC-HS-0289.',
    'estimated',
    'Chester T Kummer assigned to new northern gravesite C-0289A on 2026-07-28.',
    now()
  FROM margaret_gravesite
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    section_uuid = EXCLUDED.section_uuid,
    block_uuid = EXCLUDED.block_uuid,
    lot_uuid = EXCLUDED.lot_uuid,
    name = EXCLUDED.name,
    facility_id = EXCLUDED.facility_id,
    section_id = EXCLUDED.section_id,
    block_id = EXCLUDED.block_id,
    lot_id = EXCLUDED.lot_id,
    grave_id = EXCLUDED.grave_id,
    cost = EXCLUDED.cost,
    geometry = EXCLUDED.geometry,
    width_feet = EXCLUDED.width_feet,
    length_feet = EXCLUDED.length_feet,
    status_type_id = EXCLUDED.status_type_id,
    geometry_type = EXCLUDED.geometry_type,
    geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence,
    geometry_notes = EXCLUDED.geometry_notes,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING *
),
george_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    name,
    facility_id,
    section_id,
    block_id,
    lot_id,
    grave_id,
    gravesite_id,
    cost,
    geometry,
    width_feet,
    length_feet,
    status_type_id,
    geometry_type,
    geometry_source,
    geometry_confidence,
    geometry_notes,
    updated_at
  )
  SELECT
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    'George H Kummer',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0289B',
    'TLC-GPS-0289-02',
    cost,
    south_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Three-way split from TLC-GPS-0289 using fixed marker TLC-HS-0289.',
    'estimated',
    'George H Kummer assigned to new southern gravesite C-0289B on 2026-07-28.',
    now()
  FROM margaret_gravesite
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    section_uuid = EXCLUDED.section_uuid,
    block_uuid = EXCLUDED.block_uuid,
    lot_uuid = EXCLUDED.lot_uuid,
    name = EXCLUDED.name,
    facility_id = EXCLUDED.facility_id,
    section_id = EXCLUDED.section_id,
    block_id = EXCLUDED.block_id,
    lot_id = EXCLUDED.lot_id,
    grave_id = EXCLUDED.grave_id,
    cost = EXCLUDED.cost,
    geometry = EXCLUDED.geometry,
    width_feet = EXCLUDED.width_feet,
    length_feet = EXCLUDED.length_feet,
    status_type_id = EXCLUDED.status_type_id,
    geometry_type = EXCLUDED.geometry_type,
    geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence,
    geometry_notes = EXCLUDED.geometry_notes,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING *
),
marker_context AS (
  SELECT
    margaret_gravesite.id AS margaret_gravesite_uuid,
    chester_gravesite.id AS chester_gravesite_uuid,
    george_gravesite.id AS george_gravesite_uuid,
    margaret_gravesite.headstone_uuid
  FROM margaret_gravesite
  CROSS JOIN chester_gravesite
  CROSS JOIN george_gravesite
),
kummer_burials AS (
  SELECT
    burials.id,
    lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) AS normalized_given_name
  FROM burials
  JOIN headstone_burials
    ON headstone_burials.burial_uuid = burials.id
   AND headstone_burials.deleted_at IS NULL
  JOIN marker_context
    ON marker_context.headstone_uuid = headstone_burials.headstone_uuid
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.last_name, '')) = 'kummer'
    AND lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) IN ('chester', 'george', 'margaret')
),
updated_margaret_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.margaret_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0289',
    updated_at = now()
  FROM marker_context, kummer_burials
  WHERE burials.id = kummer_burials.id
    AND kummer_burials.normalized_given_name = 'margaret'
  RETURNING burials.id
),
updated_chester_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.chester_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0289-01',
    updated_at = now()
  FROM marker_context, kummer_burials
  WHERE burials.id = kummer_burials.id
    AND kummer_burials.normalized_given_name = 'chester'
  RETURNING burials.id
),
updated_george_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.george_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0289-02',
    updated_at = now()
  FROM marker_context, kummer_burials
  WHERE burials.id = kummer_burials.id
    AND kummer_burials.normalized_given_name = 'george'
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    updated_at
  )
  SELECT headstone_uuid, margaret_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, chester_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, george_gravesite_uuid, 'spans', now()
  FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans',
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
marker_burial_links AS (
  INSERT INTO headstone_burials (
    headstone_uuid,
    burial_uuid
  )
  SELECT marker_context.headstone_uuid, updated_margaret_burials.id
  FROM marker_context
  CROSS JOIN updated_margaret_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_chester_burials.id
  FROM marker_context
  CROSS JOIN updated_chester_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_george_burials.id
  FROM marker_context
  CROSS JOIN updated_george_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.margaret_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
