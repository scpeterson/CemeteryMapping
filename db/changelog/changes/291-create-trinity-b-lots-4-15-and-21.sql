--liquibase formatted sql

--changeset cemeterymapping:291-create-trinity-b-lots-4-15-and-21 splitStatements:false
WITH source_lots AS (
  SELECT
    lots.*,
    ST_XMax(Box2D(lots.geometry)) - ST_XMin(Box2D(lots.geometry)) AS lot_width_longitude,
    ST_YMax(Box2D(lots.geometry)) - ST_YMin(Box2D(lots.geometry)) AS lot_height_latitude
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND lots.facility_id = '1'
    AND upper(COALESCE(lots.section_id, '')) = 'B'
    AND lots.lot_id IN ('5', '14')
    AND lots.block_id IS NULL
),
new_lots AS (
  SELECT source_lots.*, '4' AS new_lot_id, 0::double precision AS longitude_delta
  FROM source_lots
  WHERE lot_id = '5'

  UNION ALL

  SELECT source_lots.*, '15' AS new_lot_id, 0::double precision AS longitude_delta
  FROM source_lots
  WHERE lot_id = '14'

  UNION ALL

  SELECT source_lots.*, '21' AS new_lot_id, -lot_width_longitude AS longitude_delta
  FROM source_lots
  WHERE lot_id = '14'
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
  'B-' || new_lot_id,
  facility_id,
  section_id,
  NULL,
  new_lot_id,
  width_feet,
  length_feet,
  ST_Translate(
    geometry,
    longitude_delta,
    lot_height_latitude
  )::geometry(MultiPolygon, 4326),
  'standard',
  NULL,
  'operational',
  'Created from the adjacent Section B lot footprints with exact shared boundaries.',
  'estimated',
  'Reviewed Section B lot reconstructed from the established B-5 and B-14 row.',
  now()
FROM new_lots
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

--rollback DELETE FROM lots WHERE facility_id = '1' AND section_id = 'B' AND lot_id IN ('4', '15', '21') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
