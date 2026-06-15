--liquibase formatted sql

--changeset cemeterymapping:087-create-trinity-c-lots-50-through-41-and-86-through-90 splitStatements:false
WITH lot_51 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '51'
    AND lots.block_id IS NULL
),
lot_70 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '70'
    AND lots.block_id IS NULL
),
anchor_grid AS (
  SELECT
    lot_51.cemetery_id,
    lot_51.section_uuid,
    lot_51.facility_id,
    lot_51.section_id,
    ST_XMin(Box2D(lot_51.geometry)) AS lot_51_west_longitude,
    ST_XMax(Box2D(lot_51.geometry)) AS lot_51_east_longitude,
    ST_YMin(Box2D(lot_51.geometry)) AS south_latitude,
    ST_YMax(Box2D(lot_51.geometry)) AS north_latitude,
    ST_XMax(Box2D(lot_51.geometry)) - ST_XMin(Box2D(lot_51.geometry)) AS lot_width_longitude
  FROM lot_51
  CROSS JOIN lot_70
  WHERE ST_XMin(Box2D(lot_70.geometry)) = ST_XMin(Box2D(lot_51.geometry))
    AND ST_XMax(Box2D(lot_70.geometry)) = ST_XMax(Box2D(lot_51.geometry))
    AND ST_YMax(Box2D(lot_70.geometry)) = ST_YMin(Box2D(lot_51.geometry))
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      (1, '50'),
      (2, '49'),
      (3, '48'),
      (4, '47'),
      (5, '46'),
      (6, '45'),
      (7, '44'),
      (8, '43'),
      (9, '42'),
      (10, '41'),
      (11, '86'),
      (12, '87'),
      (13, '88'),
      (14, '89'),
      (15, '90')
  ) AS positioned_lots(westward_offset, lot_id)
),
new_lots AS (
  SELECT
    anchor_grid.cemetery_id,
    anchor_grid.section_uuid,
    anchor_grid.facility_id,
    anchor_grid.section_id,
    lot_sequence.lot_id,
    ST_Multi(
      ST_MakeEnvelope(
        anchor_grid.lot_51_west_longitude - anchor_grid.lot_width_longitude * lot_sequence.westward_offset,
        anchor_grid.south_latitude,
        anchor_grid.lot_51_west_longitude - anchor_grid.lot_width_longitude * (lot_sequence.westward_offset - 1),
        anchor_grid.north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM anchor_grid
  CROSS JOIN lot_sequence
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
  'C-' || lot_id,
  facility_id,
  section_id,
  NULL,
  lot_id,
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('50', '49', '48', '47', '46', '45', '44', '43', '42', '41', '86', '87', '88', '89', '90') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
