--liquibase formatted sql

--changeset cemeterymapping:093-create-trinity-a-lots-52-through-60 splitStatements:false
WITH anchor_lots AS (
  SELECT
    lots.*,
    CASE lots.lot_id
      WHEN '69' THEN '52'
      WHEN '68' THEN '53'
      WHEN '67' THEN '54'
      WHEN '66' THEN '55'
      WHEN '65' THEN '56'
      WHEN '64' THEN '57'
      WHEN '63' THEN '58'
      WHEN '62' THEN '59'
      WHEN '61' THEN '60'
      ELSE NULL
    END AS new_lot_id
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'A'
    AND lots.lot_id IN ('69', '68', '67', '66', '65', '64', '63', '62', '61')
    AND lots.block_id IS NULL
),
new_lots AS (
  SELECT
    anchor_lots.cemetery_id,
    anchor_lots.section_uuid,
    anchor_lots.facility_id,
    anchor_lots.section_id,
    anchor_lots.new_lot_id AS lot_id,
    ST_Multi(
      ST_MakeEnvelope(
        ST_XMin(Box2D(anchor_lots.geometry)),
        ST_YMax(Box2D(anchor_lots.geometry)),
        ST_XMax(Box2D(anchor_lots.geometry)),
        ST_YMax(Box2D(anchor_lots.geometry)) + (ST_YMax(Box2D(anchor_lots.geometry)) - ST_YMin(Box2D(anchor_lots.geometry))),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM anchor_lots
  WHERE anchor_lots.new_lot_id IS NOT NULL
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

--rollback DELETE FROM lots WHERE section_id = 'A' AND lot_id IN ('52', '53', '54', '55', '56', '57', '58', '59', '60') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
