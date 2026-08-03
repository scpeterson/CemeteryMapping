--liquibase formatted sql

--changeset cemeterymapping:290-shift-trinity-b-lots-5-and-14-west-and-south splitStatements:false
WITH target_lots AS (
  SELECT id, geometry
  FROM lots
  WHERE deleted_at IS NULL
    AND facility_id = '1'
    AND upper(COALESCE(section_id, '')) = 'B'
    AND lot_id IN ('5', '14')
    AND block_id IS NULL
),
group_center AS (
  SELECT ST_Centroid(ST_Collect(geometry)) AS center_point
  FROM target_lots
),
translation AS (
  SELECT
    ST_X(
      ST_Project(center_point::geography, 0.6096, radians(270))::geometry
    ) - ST_X(center_point) AS longitude_delta,
    ST_Y(
      ST_Project(center_point::geography, 0.3048, radians(180))::geometry
    ) - ST_Y(center_point) AS latitude_delta
  FROM group_center
)
UPDATE lots
SET
  geometry = ST_Translate(
    target_lots.geometry,
    translation.longitude_delta,
    translation.latitude_delta
  )::geometry(MultiPolygon, 4326),
  geometry_source = 'Shifted two feet west and one foot south by reviewed placement request.',
  geometry_notes = 'Reviewed Section B lot shifted with the B-5 and B-14 row while preserving footprint and row alignment.',
  updated_at = now()
FROM target_lots, translation
WHERE lots.id = target_lots.id;

--rollback empty
