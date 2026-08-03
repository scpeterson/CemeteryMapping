--liquibase formatted sql

--changeset cemeterymapping:282-create-trinity-b-lot-11 splitStatements:false
WITH lot_b_8 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND lots.facility_id = '1'
    AND upper(COALESCE(lots.section_id, '')) = 'B'
    AND lots.lot_id = '8'
    AND lots.block_id IS NULL
  LIMIT 1
),
new_lot AS (
  SELECT
    lot_b_8.*,
    ST_XMin(Box2D(lot_b_8.geometry)) AS east_longitude,
    ST_XMax(Box2D(lot_b_8.geometry)) - ST_XMin(Box2D(lot_b_8.geometry)) AS lot_width_longitude,
    ST_YMin(Box2D(lot_b_8.geometry)) AS south_latitude,
    ST_YMax(Box2D(lot_b_8.geometry)) AS north_latitude
  FROM lot_b_8
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
  burial_use_status,
  burial_use_notes,
  geometry_type,
  geometry_source,
  geometry_confidence,
  geometry_notes,
  updated_at
)
SELECT
  cemetery_id,
  section_uuid,
  'B-11',
  facility_id,
  section_id,
  NULL,
  '11',
  width_feet,
  length_feet,
  ST_Multi(
    ST_MakeEnvelope(
      east_longitude - lot_width_longitude,
      south_latitude,
      east_longitude,
      north_latitude,
      4326
    )
  )::geometry(MultiPolygon, 4326),
  'standard',
  NULL,
  'operational',
  'Created as an exact westward copy of B-8 with a shared lot boundary.',
  'estimated',
  'Reviewed Section B lot reconstructed from the B-8 footprint.',
  now()
FROM new_lot
ON CONFLICT (facility_id, section_id, lot_id) WHERE block_id IS NULL DO UPDATE SET
  cemetery_id = EXCLUDED.cemetery_id,
  section_uuid = EXCLUDED.section_uuid,
  name = EXCLUDED.name,
  width_feet = EXCLUDED.width_feet,
  length_feet = EXCLUDED.length_feet,
  geometry = EXCLUDED.geometry,
  burial_use_status = EXCLUDED.burial_use_status,
  burial_use_notes = EXCLUDED.burial_use_notes,
  geometry_type = EXCLUDED.geometry_type,
  geometry_source = EXCLUDED.geometry_source,
  geometry_confidence = EXCLUDED.geometry_confidence,
  geometry_notes = EXCLUDED.geometry_notes,
  updated_at = now(),
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback DELETE FROM lots WHERE facility_id = '1' AND section_id = 'B' AND lot_id = '11' AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
