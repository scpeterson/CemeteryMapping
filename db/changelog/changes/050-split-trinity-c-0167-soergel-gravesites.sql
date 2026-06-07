--liquibase formatted sql

--changeset cemeterymapping:050-split-trinity-c-0167-soergel-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0167'
   AND headstones.deleted_at IS NULL
   AND headstones.gravesite_uuid = gravesites.id
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN ('TLC-GPS-0167', 'TLC-GPS-0167-02')
    AND upper(gravesites.section_id) = 'C'
  ORDER BY gravesites.gravesite_id = 'TLC-GPS-0167' DESC
  LIMIT 1
),
projected_corners AS (
  SELECT
    source_record.*,
    headstone_point AS north_south_west,
    ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry AS north_north_west,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS south_south_west
  FROM source_record
),
replacement_geometries AS (
  SELECT
    projected_corners.*,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            north_south_west,
            ST_Project(north_south_west::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(north_north_west::geography, 10 * 0.3048, pi() / 2)::geometry,
            north_north_west,
            north_south_west
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            south_south_west,
            ST_Project(south_south_west::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(north_south_west::geography, 10 * 0.3048, pi() / 2)::geometry,
            north_south_west,
            south_south_west
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS south_geometry
  FROM projected_corners
),
roy_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Roy R Soergel',
    grave_id = '0167B',
    gravesite_id = 'TLC-GPS-0167-02',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING
    gravesites.*,
    replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry
),
ruby_gravesite AS (
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
    updated_at
  )
  SELECT
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    'Ruby I Soergel',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0167A',
    'TLC-GPS-0167-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    now()
  FROM roy_gravesite
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
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING *
),
marker_context AS (
  SELECT
    roy_gravesite.id AS roy_gravesite_uuid,
    ruby_gravesite.id AS ruby_gravesite_uuid,
    roy_gravesite.headstone_uuid
  FROM roy_gravesite
  CROSS JOIN ruby_gravesite
),
updated_roy_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.roy_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0167-02',
    first_name = 'Roy R',
    last_name = 'Soergel',
    full_name = 'Roy R Soergel',
    updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND burials.gravesite_uuid = marker_context.roy_gravesite_uuid
    AND (
      lower(COALESCE(burials.full_name, '')) = 'roy r soergel'
      OR burials.notes LIKE '%Person column: 1.%'
    )
  RETURNING burials.id
),
updated_ruby_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.ruby_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0167-01',
    first_name = 'Ruby I',
    last_name = 'Soergel',
    full_name = 'Ruby I Soergel',
    updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND burials.gravesite_uuid = marker_context.roy_gravesite_uuid
    AND (
      lower(COALESCE(burials.full_name, '')) = 'ruby i soergel'
      OR burials.notes LIKE '%Person column: 2.%'
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
  SELECT headstone_uuid, roy_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, ruby_gravesite_uuid, 'spans', now()
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
  SELECT marker_context.headstone_uuid, updated_roy_burials.id
  FROM marker_context
  CROSS JOIN updated_roy_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_ruby_burials.id
  FROM marker_context
  CROSS JOIN updated_ruby_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.ruby_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
