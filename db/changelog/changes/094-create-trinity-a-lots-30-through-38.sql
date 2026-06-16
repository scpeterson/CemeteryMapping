--liquibase formatted sql

--changeset cemeterymapping:094-create-trinity-a-lots-30-through-38 splitStatements:false
WITH c_29 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '29'
    AND lots.block_id IS NULL
),
section_a AS (
  SELECT sections.*
  FROM sections
  CROSS JOIN c_29
  WHERE sections.deleted_at IS NULL
    AND sections.cemetery_id = c_29.cemetery_id
    AND sections.facility_id = c_29.facility_id
    AND sections.name = 'A'
),
anchor_grid AS (
  SELECT
    c_29.cemetery_id,
    section_a.section_id AS section_uuid,
    c_29.facility_id,
    section_a.name AS section_id,
    ST_XMax(Box2D(c_29.geometry)) AS c_29_east_longitude,
    ST_YMin(Box2D(c_29.geometry)) AS south_latitude,
    ST_YMax(Box2D(c_29.geometry)) AS north_latitude,
    ST_XMax(Box2D(c_29.geometry)) - ST_XMin(Box2D(c_29.geometry)) AS lot_width_longitude
  FROM c_29
  CROSS JOIN section_a
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      (0, '30'),
      (1, '31'),
      (2, '32'),
      (3, '33'),
      (4, '34'),
      (5, '35'),
      (6, '36'),
      (7, '37'),
      (8, '38')
  ) AS positioned_lots(eastward_offset, lot_id)
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
        anchor_grid.c_29_east_longitude + anchor_grid.lot_width_longitude * 1.2 + anchor_grid.lot_width_longitude * lot_sequence.eastward_offset,
        anchor_grid.south_latitude,
        anchor_grid.c_29_east_longitude + anchor_grid.lot_width_longitude * 1.2 + anchor_grid.lot_width_longitude * (lot_sequence.eastward_offset + 1),
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
  'A-' || lot_id,
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

--rollback DELETE FROM lots WHERE section_id = 'A' AND lot_id IN ('30', '31', '32', '33', '34', '35', '36', '37', '38') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
