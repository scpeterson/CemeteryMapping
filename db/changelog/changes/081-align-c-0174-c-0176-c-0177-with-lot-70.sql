--liquibase formatted sql

--changeset cemeterymapping:081-align-c-0174-c-0176-c-0177-with-lot-70 splitStatements:false
WITH alignment_context AS (
  SELECT
    ST_XMin(Box2D(c_70_166b.geometry)) AS c_70_166b_west,
    ST_XMax(Box2D(c_70_166b.geometry)) - ST_XMin(Box2D(c_70_166b.geometry)) AS c_70_166b_width,
    ST_YMax(Box2D(c_70_166b.geometry)) - ST_YMin(Box2D(c_70_166b.geometry)) AS c_70_166b_height,
    ST_XMin(Box2D(c_70_167a.geometry)) AS c_70_167a_west,
    ST_XMax(Box2D(c_70_167a.geometry)) - ST_XMin(Box2D(c_70_167a.geometry)) AS c_70_167a_width,
    ST_YMax(Box2D(c_70_167a.geometry)) - ST_YMin(Box2D(c_70_167a.geometry)) AS c_70_167a_height,
    ST_XMin(Box2D(c_70_0168.geometry)) AS c_70_0168_west,
    ST_XMax(Box2D(c_70_0168.geometry)) - ST_XMin(Box2D(c_70_0168.geometry)) AS c_70_0168_width,
    ST_YMax(Box2D(c_70_0168.geometry)) - ST_YMin(Box2D(c_70_0168.geometry)) AS c_70_0168_height,
    ST_YMin(Box2D(c_0175b.geometry)) AS c_0175b_south,
    ST_YMax(Box2D(c_0175a.geometry)) AS c_0175a_north
  FROM gravesites c_70_166b
  JOIN gravesites c_70_167a
    ON c_70_167a.deleted_at IS NULL
   AND c_70_167a.gravesite_id = 'TLC-GPS-0167-01'
  JOIN gravesites c_70_0168
    ON c_70_0168.deleted_at IS NULL
   AND c_70_0168.gravesite_id = 'TLC-GPS-0168'
  JOIN gravesites c_0175b
    ON c_0175b.deleted_at IS NULL
   AND c_0175b.gravesite_id = 'TLC-GPS-0175-02'
  JOIN gravesites c_0175a
    ON c_0175a.deleted_at IS NULL
   AND c_0175a.gravesite_id = 'TLC-GPS-0175-01'
  WHERE c_70_166b.deleted_at IS NULL
    AND c_70_166b.gravesite_id = 'TLC-GPS-0166-02'
),
target_bounds AS (
  SELECT
    'TLC-GPS-0174' AS gravesite_id,
    'TLC-HS-0174' AS headstone_id,
    c_70_166b_west - c_70_166b_width AS west_longitude,
    c_70_166b_west AS east_longitude,
    c_0175b_south - c_70_166b_height AS south_latitude,
    c_0175b_south AS north_latitude
  FROM alignment_context
  UNION ALL
  SELECT
    'TLC-GPS-0176',
    'TLC-HS-0176',
    c_70_167a_west - c_70_167a_width,
    c_70_167a_west,
    c_0175a_north,
    c_0175a_north + c_70_167a_height
  FROM alignment_context
  UNION ALL
  SELECT
    'TLC-GPS-0177',
    'TLC-HS-0177',
    c_70_0168_west - c_70_0168_width,
    c_70_0168_west,
    c_0175a_north + c_70_167a_height,
    c_0175a_north + c_70_167a_height + c_70_0168_height
  FROM alignment_context
),
target_geometries AS (
  SELECT
    gravesite_id,
    headstone_id,
    ST_Multi(
      ST_MakeEnvelope(
        west_longitude,
        south_latitude,
        east_longitude,
        north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS gravesite_geometry,
    ST_SetSRID(
      ST_MakePoint(
        west_longitude,
        south_latitude + ((north_latitude - south_latitude) / 2)
      ),
      4326
    )::geometry(Point, 4326) AS headstone_geometry
  FROM target_bounds
),
updated_gravesites AS (
  UPDATE gravesites
  SET
    geometry = target_geometries.gravesite_geometry,
    updated_at = now()
  FROM target_geometries
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = target_geometries.gravesite_id
  RETURNING gravesites.gravesite_id
)
UPDATE headstones
SET
  geometry = target_geometries.headstone_geometry,
  longitude = ST_X(target_geometries.headstone_geometry),
  latitude = ST_Y(target_geometries.headstone_geometry),
  updated_at = now()
FROM target_geometries
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id = target_geometries.headstone_id
  AND EXISTS (
    SELECT 1
    FROM updated_gravesites
    WHERE updated_gravesites.gravesite_id = target_geometries.gravesite_id
  );

--rollback empty
