--liquibase formatted sql

--changeset cemeterymapping:055-split-c-0172-simpson-gravesites splitStatements:false
WITH anchor AS (
  SELECT
    ST_XMin(Box2D(geometry)) AS west_longitude,
    ST_XMax(Box2D(geometry)) AS east_longitude,
    ST_YMax(Box2D(geometry)) AS south_james_latitude,
    ST_YMax(Box2D(geometry)) - ST_YMin(Box2D(geometry)) AS gravesite_height
  FROM gravesites
  WHERE deleted_at IS NULL
    AND gravesite_id = 'TLC-GPS-0171-01'
),
aligned_geometries AS (
  SELECT
    ST_Multi(ST_MakeEnvelope(west_longitude, south_james_latitude, east_longitude, south_james_latitude + gravesite_height, 4326))::geometry(MultiPolygon, 4326) AS james_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, south_james_latitude + gravesite_height, east_longitude, south_james_latitude + gravesite_height * 2, 4326))::geometry(MultiPolygon, 4326) AS ruth_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, south_james_latitude + gravesite_height), 4326)::geometry(Point, 4326) AS shared_headstone_geometry
  FROM anchor
),
c_0172_source AS (
  SELECT gravesites.*
  FROM gravesites
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN ('TLC-GPS-0172', 'TLC-GPS-0172-02')
  ORDER BY gravesites.gravesite_id = 'TLC-GPS-0172' DESC
  LIMIT 1
),
james_gravesite AS (
  UPDATE gravesites
  SET
    name = 'James H Simpson',
    grave_id = '0172B',
    gravesite_id = 'TLC-GPS-0172-02',
    geometry = aligned_geometries.james_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    updated_at = now()
  FROM c_0172_source
  CROSS JOIN aligned_geometries
  WHERE gravesites.id = c_0172_source.id
  RETURNING gravesites.*
),
ruth_gravesite AS (
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
    c_0172_source.cemetery_id,
    c_0172_source.section_uuid,
    c_0172_source.block_uuid,
    c_0172_source.lot_uuid,
    'Ruth F Simpson',
    c_0172_source.facility_id,
    c_0172_source.section_id,
    c_0172_source.block_id,
    c_0172_source.lot_id,
    '0172A',
    'TLC-GPS-0172-01',
    c_0172_source.cost,
    aligned_geometries.ruth_geometry,
    4.00,
    10.00,
    c_0172_source.status_type_id,
    now()
  FROM c_0172_source
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
simpson_marker AS (
  SELECT
    headstones.id AS headstone_uuid,
    ruth_gravesite.id AS ruth_gravesite_uuid,
    james_gravesite.id AS james_gravesite_uuid
  FROM headstones
  CROSS JOIN ruth_gravesite
  CROSS JOIN james_gravesite
  WHERE headstones.deleted_at IS NULL
    AND headstones.headstone_id = 'TLC-HS-0172'
),
updated_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = CASE
      WHEN burials.notes LIKE '%Person column: 2.%' THEN simpson_marker.ruth_gravesite_uuid
      ELSE simpson_marker.james_gravesite_uuid
    END,
    gravesite_id = CASE
      WHEN burials.notes LIKE '%Person column: 2.%' THEN 'TLC-GPS-0172-01'
      ELSE 'TLC-GPS-0172-02'
    END,
    updated_at = now()
  FROM simpson_marker
  WHERE burials.deleted_at IS NULL
    AND burials.gravesite_uuid = simpson_marker.james_gravesite_uuid
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
  SELECT headstone_uuid, ruth_gravesite_uuid, 'spans', now()
  FROM simpson_marker
  UNION ALL
  SELECT headstone_uuid, james_gravesite_uuid, 'spans', now()
  FROM simpson_marker
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans',
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
)
UPDATE headstones
SET
  gravesite_uuid = simpson_marker.ruth_gravesite_uuid,
  geometry = aligned_geometries.shared_headstone_geometry,
  longitude = ST_X(aligned_geometries.shared_headstone_geometry),
  latitude = ST_Y(aligned_geometries.shared_headstone_geometry),
  updated_at = now()
FROM simpson_marker
CROSS JOIN aligned_geometries
WHERE headstones.deleted_at IS NULL
  AND headstones.id = simpson_marker.headstone_uuid;

--rollback empty
