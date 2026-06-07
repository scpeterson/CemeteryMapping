--liquibase formatted sql

--changeset cemeterymapping:052-align-trinity-c-0168-with-soergel-block splitStatements:false
WITH current_boxes AS (
  SELECT
    gravesite_id,
    geometry,
    ST_XMin(Box2D(geometry)) AS west_longitude,
    ST_YMin(Box2D(geometry)) AS south_latitude,
    ST_YMax(Box2D(geometry)) AS north_latitude
  FROM gravesites
  WHERE deleted_at IS NULL
    AND gravesite_id IN (
      'TLC-GPS-0166-01',
      'TLC-GPS-0166-02',
      'TLC-GPS-0167-01',
      'TLC-GPS-0167-02',
      'TLC-GPS-0168'
    )
),
anchor AS (
  SELECT
    c_0166a.geometry AS c_0166a_geometry,
    c_0166a.west_longitude,
    c_0166a.north_latitude - c_0166a.south_latitude AS gravesite_height,
    (c_0168.south_latitude - c_0167a.north_latitude) / 2 AS half_gap
  FROM current_boxes c_0166a
  CROSS JOIN current_boxes c_0167a
  CROSS JOIN current_boxes c_0168
  WHERE c_0166a.gravesite_id = 'TLC-GPS-0166-01'
    AND c_0167a.gravesite_id = 'TLC-GPS-0167-01'
    AND c_0168.gravesite_id = 'TLC-GPS-0168'
),
aligned_geometries AS (
  SELECT
    ST_Translate(c_0166a_geometry, 0, half_gap - gravesite_height)::geometry(MultiPolygon, 4326) AS c_0166b_geometry,
    ST_Translate(c_0166a_geometry, 0, half_gap)::geometry(MultiPolygon, 4326) AS c_0166a_geometry,
    ST_Translate(c_0166a_geometry, 0, half_gap + gravesite_height)::geometry(MultiPolygon, 4326) AS c_0167b_geometry,
    ST_Translate(c_0166a_geometry, 0, half_gap + gravesite_height * 2)::geometry(MultiPolygon, 4326) AS c_0167a_geometry,
    ST_Translate(c_0166a_geometry, 0, half_gap + gravesite_height * 3)::geometry(MultiPolygon, 4326) AS c_0168_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, ST_YMin(Box2D(c_0166a_geometry)) + half_gap), 4326)::geometry(Point, 4326) AS c_0166_headstone_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, ST_YMin(Box2D(c_0166a_geometry)) + half_gap + gravesite_height * 2), 4326)::geometry(Point, 4326) AS c_0167_headstone_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, ST_YMin(Box2D(c_0166a_geometry)) + half_gap + gravesite_height * 3.5), 4326)::geometry(Point, 4326) AS c_0168_headstone_geometry
  FROM anchor
),
updated_gravesites AS (
  UPDATE gravesites
  SET
    geometry = CASE gravesites.gravesite_id
      WHEN 'TLC-GPS-0166-02' THEN aligned_geometries.c_0166b_geometry
      WHEN 'TLC-GPS-0166-01' THEN aligned_geometries.c_0166a_geometry
      WHEN 'TLC-GPS-0167-02' THEN aligned_geometries.c_0167b_geometry
      WHEN 'TLC-GPS-0167-01' THEN aligned_geometries.c_0167a_geometry
      WHEN 'TLC-GPS-0168' THEN aligned_geometries.c_0168_geometry
      ELSE gravesites.geometry
    END,
    updated_at = now()
  FROM aligned_geometries
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN (
      'TLC-GPS-0166-01',
      'TLC-GPS-0166-02',
      'TLC-GPS-0167-01',
      'TLC-GPS-0167-02',
      'TLC-GPS-0168'
    )
  RETURNING gravesites.id
),
headstone_positions(headstone_id, geometry) AS (
  SELECT 'TLC-HS-0166', c_0166_headstone_geometry FROM aligned_geometries
  UNION ALL
  SELECT 'TLC-HS-0167', c_0167_headstone_geometry FROM aligned_geometries
  UNION ALL
  SELECT 'TLC-HS-0168', c_0168_headstone_geometry FROM aligned_geometries
)
UPDATE headstones
SET
  geometry = headstone_positions.geometry,
  longitude = ST_X(headstone_positions.geometry),
  latitude = ST_Y(headstone_positions.geometry),
  updated_at = now()
FROM headstone_positions
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id = headstone_positions.headstone_id
  AND EXISTS (SELECT 1 FROM updated_gravesites);

--rollback empty
