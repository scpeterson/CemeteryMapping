--liquibase formatted sql

--changeset cemeterymapping:063-create-trinity-c-lot-29 splitStatements:false
WITH c_0172a AS (
  SELECT gravesites.*
  FROM gravesites
  WHERE gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
    AND gravesites.gravesite_id = 'TLC-GPS-0172-01'
),
lot_29_geometry AS (
  SELECT
    c_0172a.cemetery_id,
    c_0172a.section_uuid,
    c_0172a.facility_id,
    c_0172a.section_id,
    ST_Multi(
      ST_Transform(
        ST_MakeEnvelope(
          ST_XMin(Box2D(ST_Transform(c_0172a.geometry, 2272))),
          ST_YMax(Box2D(ST_Transform(c_0172a.geometry, 2272))) + 2,
          ST_XMax(Box2D(ST_Transform(c_0172a.geometry, 2272))),
          ST_YMax(Box2D(ST_Transform(c_0172a.geometry, 2272))) + 22,
          2272
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM c_0172a
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
  'C-29',
  facility_id,
  section_id,
  NULL,
  '29',
  20.00,
  20.00,
  geometry,
  now()
FROM lot_29_geometry
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id = '29' AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
