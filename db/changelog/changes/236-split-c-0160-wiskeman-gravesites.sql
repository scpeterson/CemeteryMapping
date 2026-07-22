--liquibase formatted sql

--changeset cemeterymapping:236-split-c-0160-wiskeman-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0160'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0160'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
projected_corners AS (
  SELECT
    source_record.*,
    headstone_point AS shared_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry AS north_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS south_west_corner
  FROM source_record
),
replacement_geometries AS (
  SELECT
    projected_corners.*,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            shared_west_corner,
            ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            north_west_corner,
            shared_west_corner
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            south_west_corner,
            ST_Project(south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            shared_west_corner,
            south_west_corner
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS south_geometry
  FROM projected_corners
),
clair_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Clair R Wiskeman',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0160 using fixed marker TLC-HS-0160 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Clair R Wiskeman retained in original gravesite C-0160 and moved south when splitting shared Wiskeman marker on 2026-07-22.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING
    gravesites.*,
    replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry
),
martha_gravesite AS (
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
    'Martha Wiskeman',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0160A',
    'TLC-GPS-0160-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Split from TLC-GPS-0160 using fixed marker TLC-HS-0160 as shared north/south boundary.',
    'estimated',
    'Martha Wiskeman assigned to the new northern gravesite C-0160A when splitting shared Wiskeman marker on 2026-07-22.',
    now()
  FROM clair_gravesite
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
    clair_gravesite.id AS clair_gravesite_uuid,
    martha_gravesite.id AS martha_gravesite_uuid,
    clair_gravesite.headstone_uuid
  FROM clair_gravesite
  CROSS JOIN martha_gravesite
),
wiskeman_burials AS (
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
    AND (
      lower(COALESCE(burials.full_name, '')) LIKE 'clair%wiskeman%'
      OR lower(COALESCE(burials.full_name, '')) LIKE 'martha%wiskeman%'
      OR (
        lower(COALESCE(burials.last_name, '')) IN ('wiskeman', 'fisher')
        AND (
          lower(COALESCE(burials.first_name, '')) LIKE 'clair%'
          OR lower(COALESCE(burials.first_name, '')) LIKE 'martha%'
        )
      )
    )
),
updated_clair_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.clair_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0160',
    updated_at = now()
  FROM marker_context, wiskeman_burials
  WHERE burials.id = wiskeman_burials.id
    AND (
      wiskeman_burials.normalized_full_name LIKE 'clair%wiskeman%'
      OR wiskeman_burials.normalized_first_name LIKE 'clair%'
    )
  RETURNING burials.id
),
updated_martha_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.martha_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0160-01',
    updated_at = now()
  FROM marker_context, wiskeman_burials
  WHERE burials.id = wiskeman_burials.id
    AND (
      wiskeman_burials.normalized_full_name LIKE 'martha%wiskeman%'
      OR wiskeman_burials.normalized_first_name LIKE 'martha%'
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
  SELECT headstone_uuid, martha_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, clair_gravesite_uuid, 'spans', now()
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
  SELECT marker_context.headstone_uuid, updated_clair_burials.id
  FROM marker_context
  CROSS JOIN updated_clair_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_martha_burials.id
  FROM marker_context
  CROSS JOIN updated_martha_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.clair_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
