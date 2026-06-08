--liquibase formatted sql

--changeset cemeterymapping:054-align-c-0169-through-c-0172-and-split-c-0171 splitStatements:false
WITH anchor AS (
  SELECT
    ST_XMin(Box2D(geometry)) AS west_longitude,
    ST_XMax(Box2D(geometry)) AS east_longitude,
    ST_YMax(Box2D(geometry)) - ST_YMin(Box2D(geometry)) AS gravesite_height
  FROM gravesites
  WHERE deleted_at IS NULL
    AND gravesite_id = 'TLC-GPS-0168'
),
c_0169_position AS (
  SELECT
    ST_YMin(Box2D(geometry)) AS south_latitude
  FROM gravesites
  WHERE deleted_at IS NULL
    AND gravesite_id = 'TLC-GPS-0169'
),
aligned_boxes AS (
  SELECT
    anchor.west_longitude,
    anchor.east_longitude,
    anchor.gravesite_height,
    c_0169_position.south_latitude,
    c_0169_position.south_latitude + anchor.gravesite_height AS c_0169_north,
    c_0169_position.south_latitude + anchor.gravesite_height * 2 AS c_0170_north,
    c_0169_position.south_latitude + anchor.gravesite_height * 3 AS c_0171b_north,
    c_0169_position.south_latitude + anchor.gravesite_height * 4 AS c_0171a_north,
    c_0169_position.south_latitude + anchor.gravesite_height * 5 AS c_0172_north
  FROM anchor
  CROSS JOIN c_0169_position
),
aligned_geometries AS (
  SELECT
    ST_Multi(ST_MakeEnvelope(west_longitude, south_latitude, east_longitude, c_0169_north, 4326))::geometry(MultiPolygon, 4326) AS c_0169_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0169_north, east_longitude, c_0170_north, 4326))::geometry(MultiPolygon, 4326) AS c_0170_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0170_north, east_longitude, c_0171b_north, 4326))::geometry(MultiPolygon, 4326) AS c_0171b_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0171b_north, east_longitude, c_0171a_north, 4326))::geometry(MultiPolygon, 4326) AS c_0171a_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0171a_north, east_longitude, c_0172_north, 4326))::geometry(MultiPolygon, 4326) AS c_0172_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, (south_latitude + c_0169_north) / 2), 4326)::geometry(Point, 4326) AS c_0169_headstone_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, (c_0169_north + c_0170_north) / 2), 4326)::geometry(Point, 4326) AS c_0170_headstone_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, c_0171b_north), 4326)::geometry(Point, 4326) AS c_0171_headstone_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, (c_0171a_north + c_0172_north) / 2), 4326)::geometry(Point, 4326) AS c_0172_headstone_geometry
  FROM aligned_boxes
),
c_0171_source AS (
  SELECT gravesites.*
  FROM gravesites
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN ('TLC-GPS-0171', 'TLC-GPS-0171-02')
  ORDER BY gravesites.gravesite_id = 'TLC-GPS-0171' DESC
  LIMIT 1
),
updated_existing_gravesites AS (
  UPDATE gravesites
  SET
    name = CASE gravesites.gravesite_id
      WHEN 'TLC-GPS-0171' THEN 'James D Gillen'
      WHEN 'TLC-GPS-0171-02' THEN 'James D Gillen'
      ELSE gravesites.name
    END,
    grave_id = CASE gravesites.gravesite_id
      WHEN 'TLC-GPS-0171' THEN '0171B'
      ELSE gravesites.grave_id
    END,
    gravesite_id = CASE gravesites.gravesite_id
      WHEN 'TLC-GPS-0171' THEN 'TLC-GPS-0171-02'
      ELSE gravesites.gravesite_id
    END,
    geometry = CASE gravesites.gravesite_id
      WHEN 'TLC-GPS-0169' THEN aligned_geometries.c_0169_geometry
      WHEN 'TLC-GPS-0170' THEN aligned_geometries.c_0170_geometry
      WHEN 'TLC-GPS-0171' THEN aligned_geometries.c_0171b_geometry
      WHEN 'TLC-GPS-0171-02' THEN aligned_geometries.c_0171b_geometry
      WHEN 'TLC-GPS-0172' THEN aligned_geometries.c_0172_geometry
      ELSE gravesites.geometry
    END,
    width_feet = 4.00,
    length_feet = 10.00,
    updated_at = now()
  FROM aligned_geometries
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN (
      'TLC-GPS-0169',
      'TLC-GPS-0170',
      'TLC-GPS-0171',
      'TLC-GPS-0171-02',
      'TLC-GPS-0172'
    )
  RETURNING gravesites.*
),
emma_gravesite AS (
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
    c_0171_source.cemetery_id,
    c_0171_source.section_uuid,
    c_0171_source.block_uuid,
    c_0171_source.lot_uuid,
    'Emma (Heep) Gillen',
    c_0171_source.facility_id,
    c_0171_source.section_id,
    c_0171_source.block_id,
    c_0171_source.lot_id,
    '0171A',
    'TLC-GPS-0171-01',
    c_0171_source.cost,
    aligned_geometries.c_0171a_geometry,
    4.00,
    10.00,
    c_0171_source.status_type_id,
    now()
  FROM c_0171_source
  CROSS JOIN aligned_geometries
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
james_gravesite AS (
  SELECT *
  FROM updated_existing_gravesites
  WHERE gravesite_id = 'TLC-GPS-0171-02'
  LIMIT 1
),
gillen_marker AS (
  SELECT
    headstones.id AS headstone_uuid,
    emma_gravesite.id AS emma_gravesite_uuid,
    james_gravesite.id AS james_gravesite_uuid
  FROM headstones
  CROSS JOIN emma_gravesite
  CROSS JOIN james_gravesite
  WHERE headstones.deleted_at IS NULL
    AND headstones.headstone_id = 'TLC-HS-0171'
),
updated_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = CASE
      WHEN burials.notes LIKE '%Person column: 2.%' THEN gillen_marker.emma_gravesite_uuid
      ELSE gillen_marker.james_gravesite_uuid
    END,
    gravesite_id = CASE
      WHEN burials.notes LIKE '%Person column: 2.%' THEN 'TLC-GPS-0171-01'
      ELSE 'TLC-GPS-0171-02'
    END,
    first_name = CASE
      WHEN burials.notes LIKE '%Person column: 2.%' THEN 'Emma'
      ELSE 'James D'
    END,
    last_name = CASE
      WHEN burials.notes LIKE '%Person column: 2.%' THEN '(Heep) Gillen'
      ELSE 'Gillen'
    END,
    full_name = CASE
      WHEN burials.notes LIKE '%Person column: 2.%' THEN 'Emma (Heep) Gillen'
      ELSE 'James D Gillen'
    END,
    updated_at = now()
  FROM gillen_marker
  WHERE burials.deleted_at IS NULL
    AND burials.gravesite_uuid = gillen_marker.james_gravesite_uuid
    AND (
      burials.notes LIKE '%Person column: 1.%'
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
  SELECT headstone_uuid, emma_gravesite_uuid, 'spans', now()
  FROM gillen_marker
  UNION ALL
  SELECT headstone_uuid, james_gravesite_uuid, 'spans', now()
  FROM gillen_marker
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans',
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
headstone_positions(headstone_id, geometry) AS (
  SELECT 'TLC-HS-0169', c_0169_headstone_geometry FROM aligned_geometries
  UNION ALL
  SELECT 'TLC-HS-0170', c_0170_headstone_geometry FROM aligned_geometries
  UNION ALL
  SELECT 'TLC-HS-0171', c_0171_headstone_geometry FROM aligned_geometries
  UNION ALL
  SELECT 'TLC-HS-0172', c_0172_headstone_geometry FROM aligned_geometries
)
UPDATE headstones
SET
  gravesite_uuid = CASE
    WHEN headstones.headstone_id = 'TLC-HS-0171' THEN (SELECT emma_gravesite_uuid FROM gillen_marker LIMIT 1)
    ELSE headstones.gravesite_uuid
  END,
  geometry = headstone_positions.geometry,
  longitude = ST_X(headstone_positions.geometry),
  latitude = ST_Y(headstone_positions.geometry),
  updated_at = now()
FROM headstone_positions
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id = headstone_positions.headstone_id;

--rollback empty
