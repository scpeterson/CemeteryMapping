--liquibase formatted sql

--changeset cemeterymapping:091-create-trinity-c-lots-11-through-19-39-and-96-through-100 splitStatements:false
WITH lot_10 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '10'
    AND lots.block_id IS NULL
),
lot_29 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '29'
    AND lots.block_id IS NULL
),
anchor_grid AS (
  SELECT
    lot_10.cemetery_id,
    lot_10.section_uuid,
    lot_10.facility_id,
    lot_10.section_id,
    ST_XMin(Box2D(lot_10.geometry)) AS lot_10_west_longitude,
    ST_XMax(Box2D(lot_10.geometry)) AS lot_10_east_longitude,
    ST_YMin(Box2D(lot_10.geometry)) AS south_latitude,
    ST_YMax(Box2D(lot_10.geometry)) AS north_latitude,
    ST_XMax(Box2D(lot_10.geometry)) - ST_XMin(Box2D(lot_10.geometry)) AS lot_width_longitude
  FROM lot_10
  CROSS JOIN lot_29
  WHERE ST_XMin(Box2D(lot_29.geometry)) = ST_XMin(Box2D(lot_10.geometry))
    AND ST_XMax(Box2D(lot_29.geometry)) = ST_XMax(Box2D(lot_10.geometry))
    AND ST_YMax(Box2D(lot_29.geometry)) = ST_YMin(Box2D(lot_10.geometry))
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      (1, '11'),
      (2, '12'),
      (3, '13'),
      (4, '14'),
      (5, '15'),
      (6, '16'),
      (7, '17'),
      (8, '18'),
      (9, '19'),
      (10, '39'),
      (11, '96'),
      (12, '97'),
      (13, '98'),
      (14, '99'),
      (15, '100')
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
        anchor_grid.lot_10_west_longitude - anchor_grid.lot_width_longitude * lot_sequence.westward_offset,
        anchor_grid.south_latitude,
        anchor_grid.lot_10_east_longitude - anchor_grid.lot_width_longitude * lot_sequence.westward_offset,
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('11', '12', '13', '14', '15', '16', '17', '18', '19', '39', '96', '97', '98', '99', '100') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
