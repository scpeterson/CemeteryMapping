--liquibase formatted sql

--changeset cemeterymapping:079-align-c-0175a-with-c-70-167b splitStatements:false
WITH c_70_167b AS (
  SELECT
    geometry,
    ST_XMin(Box2D(geometry)) AS shared_east_longitude,
    ST_XMax(Box2D(geometry)) - ST_XMin(Box2D(geometry)) AS gravesite_width_longitude,
    ST_YMin(Box2D(geometry)) AS south_latitude,
    ST_YMax(Box2D(geometry)) AS north_latitude
  FROM gravesites
  WHERE deleted_at IS NULL
    AND gravesite_id = 'TLC-GPS-0167-02'
),
aligned_ethel_geometry AS (
  SELECT
    ST_Multi(
      ST_MakeEnvelope(
        shared_east_longitude - gravesite_width_longitude,
        south_latitude,
        shared_east_longitude,
        north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM c_70_167b
)
UPDATE gravesites
SET
  geometry = aligned_ethel_geometry.geometry,
  updated_at = now()
FROM aligned_ethel_geometry
WHERE gravesites.deleted_at IS NULL
  AND gravesites.gravesite_id = 'TLC-GPS-0175-01';

--rollback WITH c_70_166a AS (SELECT geometry, ST_XMin(Box2D(geometry)) AS shared_east_longitude, ST_XMax(Box2D(geometry)) - ST_XMin(Box2D(geometry)) AS gravesite_width_longitude, ST_YMin(Box2D(geometry)) AS south_latitude, ST_YMax(Box2D(geometry)) AS north_latitude FROM gravesites WHERE deleted_at IS NULL AND gravesite_id = 'TLC-GPS-0166-01'), aligned_ethel_geometry AS (SELECT ST_Multi(ST_MakeEnvelope(shared_east_longitude - gravesite_width_longitude, south_latitude, shared_east_longitude, north_latitude, 4326))::geometry(MultiPolygon, 4326) AS geometry FROM c_70_166a) UPDATE gravesites SET geometry = aligned_ethel_geometry.geometry, updated_at = now() FROM aligned_ethel_geometry WHERE gravesites.deleted_at IS NULL AND gravesites.gravesite_id = 'TLC-GPS-0175-01';
