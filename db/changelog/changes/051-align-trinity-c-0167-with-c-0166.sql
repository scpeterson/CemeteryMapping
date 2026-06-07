--liquibase formatted sql

--changeset cemeterymapping:051-align-trinity-c-0167-with-c-0166 splitStatements:false
WITH anchor AS (
  SELECT
    ST_YMax(Box2D(geometry)) - ST_YMin(Box2D(geometry)) AS gravesite_height,
    ST_XMin(Box2D(geometry)) AS west_longitude,
    ST_YMax(Box2D(geometry)) AS north_latitude,
    geometry AS c_0166a_geometry
  FROM gravesites
  WHERE deleted_at IS NULL
    AND gravesite_id = 'TLC-GPS-0166-01'
),
aligned_geometries AS (
  SELECT
    ST_Translate(c_0166a_geometry, 0, gravesite_height)::geometry(MultiPolygon, 4326) AS c_0167b_geometry,
    ST_Translate(c_0166a_geometry, 0, gravesite_height * 2)::geometry(MultiPolygon, 4326) AS c_0167a_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, north_latitude + gravesite_height), 4326)::geometry(Point, 4326) AS shared_headstone_geometry
  FROM anchor
),
updated_gravesites AS (
  UPDATE gravesites
  SET
    geometry = CASE gravesites.gravesite_id
      WHEN 'TLC-GPS-0167-01' THEN aligned_geometries.c_0167a_geometry
      WHEN 'TLC-GPS-0167-02' THEN aligned_geometries.c_0167b_geometry
      ELSE gravesites.geometry
    END,
    updated_at = now()
  FROM aligned_geometries
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN ('TLC-GPS-0167-01', 'TLC-GPS-0167-02')
  RETURNING gravesites.id
)
UPDATE headstones
SET
  geometry = aligned_geometries.shared_headstone_geometry,
  longitude = ST_X(aligned_geometries.shared_headstone_geometry),
  latitude = ST_Y(aligned_geometries.shared_headstone_geometry),
  updated_at = now()
FROM aligned_geometries
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id = 'TLC-HS-0167'
  AND EXISTS (SELECT 1 FROM updated_gravesites);

--rollback empty
