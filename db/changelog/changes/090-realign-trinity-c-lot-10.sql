--liquibase formatted sql

--changeset cemeterymapping:090-realign-trinity-c-lot-10 splitStatements:false
WITH lot_29 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '29'
    AND lots.block_id IS NULL
),
lot_10_geometry AS (
  SELECT
    lot_29.cemetery_id,
    lot_29.section_uuid,
    lot_29.facility_id,
    lot_29.section_id,
    ST_Multi(
      ST_MakeEnvelope(
        ST_XMin(Box2D(lot_29.geometry)),
        ST_YMax(Box2D(lot_29.geometry)),
        ST_XMax(Box2D(lot_29.geometry)),
        ST_YMax(Box2D(lot_29.geometry)) + (ST_YMax(Box2D(lot_29.geometry)) - ST_YMin(Box2D(lot_29.geometry))),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM lot_29
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
  'C-10',
  facility_id,
  section_id,
  NULL,
  '10',
  10.00,
  20.00,
  geometry,
  now()
FROM lot_10_geometry
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

--rollback empty
