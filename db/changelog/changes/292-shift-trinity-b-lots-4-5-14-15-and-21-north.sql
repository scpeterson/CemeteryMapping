--liquibase formatted sql

--changeset cemeterymapping:292-shift-trinity-b-lots-4-5-14-15-and-21-north splitStatements:false
WITH target_lots AS (
  SELECT id, geometry
  FROM lots
  WHERE deleted_at IS NULL
    AND facility_id = '1'
    AND upper(COALESCE(section_id, '')) = 'B'
    AND lot_id IN ('4', '5', '14', '15', '21')
    AND block_id IS NULL
),
group_center AS (
  SELECT ST_Centroid(ST_Collect(geometry)) AS center_point
  FROM target_lots
),
translation AS (
  SELECT
    ST_Y(
      ST_Project(center_point::geography, 0.3048, radians(0))::geometry
    ) - ST_Y(center_point) AS latitude_delta
  FROM group_center
)
UPDATE lots
SET
  geometry = ST_Translate(target_lots.geometry, 0, translation.latitude_delta)::geometry(MultiPolygon, 4326),
  geometry_source = 'Shifted one foot north by reviewed placement request.',
  geometry_notes = 'Reviewed Section B lot shifted one foot north with the five-lot group while preserving footprint and alignment.',
  updated_at = now()
FROM target_lots, translation
WHERE lots.id = target_lots.id;

--rollback empty
