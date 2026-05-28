--liquibase formatted sql

--changeset cemeterymapping:027-anchor-trinity-a-d-gravesites splitStatements:false
WITH generated_headstone_gravesites AS (
  SELECT
    gravesites.id AS gravesite_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.gravesite_uuid = gravesites.id
  WHERE gravesites.deleted_at IS NULL
    AND headstones.deleted_at IS NULL
    AND gravesites.gravesite_id LIKE 'TLC-GPS-%'
    AND headstones.headstone_id LIKE 'TLC-HS-%'
    AND upper(gravesites.section_id) IN ('A', 'B', 'C', 'D')
    AND GeometryType(headstones.geometry) = 'POINT'
),
projected_corners AS (
  SELECT
    gravesite_uuid,
    ST_Project(headstone_point::geography, 5 * 0.3048, pi())::geometry AS south_west,
    ST_Project(headstone_point::geography, 5 * 0.3048, 0)::geometry AS north_west
  FROM generated_headstone_gravesites
),
replacement_geometries AS (
  SELECT
    gravesite_uuid,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            south_west,
            ST_Project(south_west::geography, 4 * 0.3048, pi() / 2)::geometry,
            ST_Project(north_west::geography, 4 * 0.3048, pi() / 2)::geometry,
            north_west,
            south_west
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM projected_corners
)
UPDATE gravesites
SET geometry = replacement_geometries.geometry,
    updated_at = now()
FROM replacement_geometries
WHERE gravesites.id = replacement_geometries.gravesite_uuid;

--rollback empty
