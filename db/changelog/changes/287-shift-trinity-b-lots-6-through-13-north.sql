--liquibase formatted sql

--changeset cemeterymapping:287-shift-trinity-b-lots-6-through-13-north splitStatements:false
WITH target_lots AS (
  SELECT id, geometry
  FROM lots
  WHERE deleted_at IS NULL
    AND facility_id = '1'
    AND upper(COALESCE(section_id, '')) = 'B'
    AND lot_id IN ('6', '7', '8', '11', '12', '13')
    AND block_id IS NULL
),
row_center AS (
  SELECT ST_Centroid(ST_Collect(geometry)) AS center_point
  FROM target_lots
),
translation AS (
  SELECT
    ST_Y(
      ST_Project(center_point::geography, 0.762, radians(0))::geometry
    ) - ST_Y(center_point) AS latitude_delta
  FROM row_center
)
UPDATE lots
SET
  geometry = ST_Translate(target_lots.geometry, 0, translation.latitude_delta)::geometry(MultiPolygon, 4326),
  geometry_source = 'Shifted 2.5 feet north by reviewed placement request.',
  geometry_notes = 'Reviewed Section B lot shifted 2.5 feet north with the six-lot group while preserving footprint and alignment.',
  updated_at = now()
FROM target_lots, translation
WHERE lots.id = target_lots.id;

--rollback WITH target_lots AS (SELECT id, geometry FROM lots WHERE deleted_at IS NULL AND facility_id = '1' AND upper(COALESCE(section_id, '')) = 'B' AND lot_id IN ('6', '7', '8', '11', '12', '13') AND block_id IS NULL), group_center AS (SELECT ST_Centroid(ST_Collect(geometry)) AS center_point FROM target_lots), translation AS (SELECT ST_Y(ST_Project(center_point::geography, 0.762, radians(180))::geometry) - ST_Y(center_point) AS latitude_delta FROM group_center) UPDATE lots SET geometry = ST_Translate(target_lots.geometry, 0, translation.latitude_delta)::geometry(MultiPolygon, 4326), updated_at = now() FROM target_lots, translation WHERE lots.id = target_lots.id;
