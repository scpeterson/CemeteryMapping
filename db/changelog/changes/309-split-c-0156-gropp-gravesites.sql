--liquibase formatted sql

--changeset cemeterymapping:309-split-c-0156-gropp-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(ST_MakePoint(ST_XMin(gravesites.geometry::box3d), ST_YMax(gravesites.geometry::box3d)), 4326) AS north_west_corner,
    ST_SetSRID(ST_MakePoint(ST_XMax(gravesites.geometry::box3d), ST_YMax(gravesites.geometry::box3d)), 4326) AS north_east_corner
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0156'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0156'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
replacement_geometry AS (
  SELECT
    source_record.*,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            north_west_corner,
            north_east_corner,
            ST_Project(north_east_corner::geography, 4 * 0.3048, 0)::geometry,
            ST_Project(north_west_corner::geography, 4 * 0.3048, 0)::geometry,
            north_west_corner
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS north_geometry
  FROM source_record
),
manfred_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Manfred Joseph Gropp',
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Existing TLC-GPS-0156 geometry retained while adding Alice J. Gropp gravesite immediately north.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Manfred Joseph Gropp remains in original gravesite C-0156; its geometry was not moved during the 2026-08-11 split.'
    ),
    updated_at = now()
  FROM replacement_geometry
  WHERE gravesites.id = replacement_geometry.id
  RETURNING
    gravesites.*,
    replacement_geometry.headstone_uuid,
    replacement_geometry.north_geometry
),
alice_gravesite AS (
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
    'Alice J. Gropp',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0156A',
    'TLC-GPS-0156-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Placed immediately north of retained TLC-GPS-0156 geometry.',
    'estimated',
    'Alice J. Gropp assigned to new northern gravesite C-0156A when splitting shared marker TLC-HS-0156 on 2026-08-11.',
    now()
  FROM manfred_gravesite
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
    manfred_gravesite.id AS manfred_gravesite_uuid,
    alice_gravesite.id AS alice_gravesite_uuid,
    manfred_gravesite.headstone_uuid
  FROM manfred_gravesite
  CROSS JOIN alice_gravesite
),
gropp_burials AS (
  SELECT
    burials.id,
    lower(COALESCE(burials.full_name, '')) AS normalized_full_name,
    lower(COALESCE(burials.first_name, '')) AS normalized_first_name,
    lower(COALESCE(burials.last_name, '')) AS normalized_last_name
  FROM burials
  JOIN headstone_burials
    ON headstone_burials.burial_uuid = burials.id
   AND headstone_burials.deleted_at IS NULL
  JOIN marker_context
    ON marker_context.headstone_uuid = headstone_burials.headstone_uuid
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.last_name, '')) = 'gropp'
),
updated_manfred_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.manfred_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0156',
    updated_at = now()
  FROM marker_context, gropp_burials
  WHERE burials.id = gropp_burials.id
    AND (
      gropp_burials.normalized_full_name LIKE 'manfred%gropp%'
      OR gropp_burials.normalized_first_name LIKE 'manfred%'
    )
  RETURNING burials.id
),
updated_alice_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.alice_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0156-01',
    updated_at = now()
  FROM marker_context, gropp_burials
  WHERE burials.id = gropp_burials.id
    AND (
      gropp_burials.normalized_full_name LIKE 'alice%gropp%'
      OR gropp_burials.normalized_first_name LIKE 'alice%'
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    updated_at
  )
  SELECT headstone_uuid, manfred_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, alice_gravesite_uuid, 'spans', now()
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
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_manfred_burials.id
  FROM marker_context
  CROSS JOIN updated_manfred_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_alice_burials.id
  FROM marker_context
  CROSS JOIN updated_alice_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.manfred_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
