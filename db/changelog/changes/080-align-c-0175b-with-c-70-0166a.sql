--liquibase formatted sql

--changeset cemeterymapping:080-align-c-0175b-with-c-70-0166a splitStatements:false
WITH c_70_0166a AS (
  SELECT
    ST_XMin(Box2D(geometry)) AS shared_east_longitude,
    ST_XMax(Box2D(geometry)) - ST_XMin(Box2D(geometry)) AS gravesite_width_longitude,
    ST_YMin(Box2D(geometry)) AS south_latitude,
    ST_YMax(Box2D(geometry)) AS north_latitude
  FROM gravesites
  WHERE deleted_at IS NULL
    AND gravesite_id = 'TLC-GPS-0166-01'
),
aligned_herman_geometry AS (
  SELECT
    ST_Multi(
      ST_MakeEnvelope(
        shared_east_longitude - gravesite_width_longitude,
        south_latitude,
        shared_east_longitude,
        north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry,
    ST_SetSRID(
      ST_MakePoint(
        shared_east_longitude - gravesite_width_longitude,
        north_latitude
      ),
      4326
    )::geometry(Point, 4326) AS shared_headstone_geometry
  FROM c_70_0166a
),
updated_herman_gravesite AS (
  UPDATE gravesites
  SET
    geometry = aligned_herman_geometry.geometry,
    updated_at = now()
  FROM aligned_herman_geometry
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0175-02'
  RETURNING gravesites.id
)
UPDATE headstones
SET
  geometry = aligned_herman_geometry.shared_headstone_geometry,
  longitude = ST_X(aligned_herman_geometry.shared_headstone_geometry),
  latitude = ST_Y(aligned_herman_geometry.shared_headstone_geometry),
  updated_at = now()
FROM aligned_herman_geometry
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id = 'TLC-HS-0175'
  AND EXISTS (SELECT 1 FROM updated_herman_gravesite);

--rollback WITH c_70_0166b AS (SELECT ST_XMin(Box2D(geometry)) AS shared_east_longitude, ST_XMax(Box2D(geometry)) - ST_XMin(Box2D(geometry)) AS gravesite_width_longitude, ST_YMin(Box2D(geometry)) AS south_latitude, ST_YMax(Box2D(geometry)) AS north_latitude FROM gravesites WHERE deleted_at IS NULL AND gravesite_id = 'TLC-GPS-0166-02'), aligned_herman_geometry AS (SELECT ST_Multi(ST_MakeEnvelope(shared_east_longitude - gravesite_width_longitude, south_latitude, shared_east_longitude, north_latitude, 4326))::geometry(MultiPolygon, 4326) AS geometry, ST_SetSRID(ST_MakePoint(shared_east_longitude - gravesite_width_longitude, north_latitude), 4326)::geometry(Point, 4326) AS shared_headstone_geometry FROM c_70_0166b), updated_herman_gravesite AS (UPDATE gravesites SET geometry = aligned_herman_geometry.geometry, updated_at = now() FROM aligned_herman_geometry WHERE gravesites.deleted_at IS NULL AND gravesites.gravesite_id = 'TLC-GPS-0175-02' RETURNING gravesites.id) UPDATE headstones SET geometry = aligned_herman_geometry.shared_headstone_geometry, longitude = ST_X(aligned_herman_geometry.shared_headstone_geometry), latitude = ST_Y(aligned_herman_geometry.shared_headstone_geometry), updated_at = now() FROM aligned_herman_geometry WHERE headstones.deleted_at IS NULL AND headstones.headstone_id = 'TLC-HS-0175' AND EXISTS (SELECT 1 FROM updated_herman_gravesite);
