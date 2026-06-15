--liquibase formatted sql

--changeset cemeterymapping:086-create-trinity-c-lots-72-through-85 splitStatements:false
WITH lot_71 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '71'
    AND lots.block_id IS NULL
),
lot_51 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '51'
    AND lots.block_id IS NULL
),
anchor_grid AS (
  SELECT
    lot_71.cemetery_id,
    lot_71.section_uuid,
    lot_71.facility_id,
    lot_71.section_id,
    ST_XMin(Box2D(lot_71.geometry)) AS lot_71_west_longitude,
    ST_XMax(Box2D(lot_71.geometry)) AS lot_71_east_longitude,
    ST_YMin(Box2D(lot_71.geometry)) AS south_latitude,
    ST_YMax(Box2D(lot_71.geometry)) AS north_latitude,
    ST_XMax(Box2D(lot_71.geometry)) - ST_XMin(Box2D(lot_71.geometry)) AS lot_width_longitude
  FROM lot_71
  CROSS JOIN lot_51
  WHERE ST_XMin(Box2D(lot_51.geometry)) = ST_XMax(Box2D(lot_71.geometry))
    AND ST_YMin(Box2D(lot_51.geometry)) = ST_YMax(Box2D(lot_71.geometry))
),
new_lots AS (
  SELECT
    anchor_grid.cemetery_id,
    anchor_grid.section_uuid,
    anchor_grid.facility_id,
    anchor_grid.section_id,
    generated_lots.lot_number,
    ST_Multi(
      ST_MakeEnvelope(
        anchor_grid.lot_71_west_longitude - anchor_grid.lot_width_longitude * (generated_lots.lot_number - 71),
        anchor_grid.south_latitude,
        anchor_grid.lot_71_west_longitude - anchor_grid.lot_width_longitude * (generated_lots.lot_number - 72),
        anchor_grid.north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM anchor_grid
  CROSS JOIN generate_series(72, 85) AS generated_lots(lot_number)
)
INSERT INTO lots (
  cemetery_id,
  section_uuid,
  name,
  facility_id,
  section_id,
  block_id,
  lot_id,
  width_feet,
  length_feet,
  geometry,
  updated_at
)
SELECT
  cemetery_id,
  section_uuid,
  'C-' || lot_number::text,
  facility_id,
  section_id,
  NULL,
  lot_number::text,
  10.00,
  20.00,
  geometry,
  now()
FROM new_lots
ON CONFLICT (facility_id, section_id, lot_id) WHERE block_id IS NULL DO UPDATE SET
  cemetery_id = EXCLUDED.cemetery_id,
  section_uuid = EXCLUDED.section_uuid,
  name = EXCLUDED.name,
  width_feet = EXCLUDED.width_feet,
  length_feet = EXCLUDED.length_feet,
  geometry = EXCLUDED.geometry,
  updated_at = now(),
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
