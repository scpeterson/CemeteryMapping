--liquibase formatted sql

--changeset cemeterymapping:284-preserve-trinity-b-lots-8-and-11-shared-edge splitStatements:false
WITH lot_b_8 AS (
  SELECT ST_XMin(Box2D(geometry)) AS shared_longitude
  FROM lots
  WHERE deleted_at IS NULL
    AND facility_id = '1'
    AND upper(COALESCE(section_id, '')) = 'B'
    AND lot_id = '8'
    AND block_id IS NULL
  LIMIT 1
),
lot_b_11 AS (
  SELECT
    id,
    geometry,
    ST_XMax(Box2D(geometry)) AS east_longitude
  FROM lots
  WHERE deleted_at IS NULL
    AND facility_id = '1'
    AND upper(COALESCE(section_id, '')) = 'B'
    AND lot_id = '11'
    AND block_id IS NULL
  LIMIT 1
)
UPDATE lots
SET
  geometry = ST_Translate(
    lot_b_11.geometry,
    lot_b_8.shared_longitude - lot_b_11.east_longitude,
    0
  )::geometry(MultiPolygon, 4326),
  updated_at = now()
FROM lot_b_8, lot_b_11
WHERE lots.id = lot_b_11.id;

--rollback empty
