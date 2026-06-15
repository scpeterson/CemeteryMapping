--liquibase formatted sql

--changeset cemeterymapping:088-create-trinity-c-lots-28-through-20-40-and-91-through-95 splitStatements:false
WITH lot_29 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '29'
    AND lots.block_id IS NULL
),
lot_10 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '10'
    AND lots.block_id IS NULL
),
anchor_grid AS (
  SELECT
    lot_29.cemetery_id,
    lot_29.section_uuid,
    lot_29.facility_id,
    lot_29.section_id,
    ST_XMin(Box2D(lot_29.geometry)) AS lot_29_west_longitude,
    ST_XMax(Box2D(lot_29.geometry)) AS lot_29_east_longitude,
    ST_YMin(Box2D(lot_29.geometry)) AS south_latitude,
    ST_YMax(Box2D(lot_29.geometry)) AS north_latitude,
    ST_XMax(Box2D(lot_29.geometry)) - ST_XMin(Box2D(lot_29.geometry)) AS lot_width_longitude
  FROM lot_29
  CROSS JOIN lot_10
  WHERE ST_YMin(Box2D(lot_10.geometry)) >= ST_YMax(Box2D(lot_29.geometry)) - 0.000001
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      (1, '28'),
      (2, '27'),
      (3, '26'),
      (4, '25'),
      (5, '24'),
      (6, '23'),
      (7, '22'),
      (8, '21'),
      (9, '20'),
      (10, '40'),
      (11, '91'),
      (12, '92'),
      (13, '93'),
      (14, '94'),
      (15, '95')
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
        anchor_grid.lot_29_west_longitude - anchor_grid.lot_width_longitude * lot_sequence.westward_offset,
        anchor_grid.south_latitude,
        anchor_grid.lot_29_west_longitude - anchor_grid.lot_width_longitude * (lot_sequence.westward_offset - 1),
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('28', '27', '26', '25', '24', '23', '22', '21', '20', '40', '91', '92', '93', '94', '95') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
