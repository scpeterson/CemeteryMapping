--liquibase formatted sql

--changeset cemeterymapping:064-create-trinity-c-lot-10 splitStatements:false
WITH c_29 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '29'
    AND lots.block_id IS NULL
),
lot_10_geometry AS (
  SELECT
    c_29.cemetery_id,
    c_29.section_uuid,
    c_29.facility_id,
    c_29.section_id,
    ST_Multi(
      ST_Transform(
        ST_MakeEnvelope(
          ST_XMin(Box2D(ST_Transform(c_29.geometry, 2272))),
          ST_YMax(Box2D(ST_Transform(c_29.geometry, 2272))),
          ST_XMax(Box2D(ST_Transform(c_29.geometry, 2272))),
          ST_YMax(Box2D(ST_Transform(c_29.geometry, 2272))) + 20,
          2272
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM c_29
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
  20.00,
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id = '10' AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
