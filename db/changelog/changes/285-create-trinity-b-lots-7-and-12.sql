--liquibase formatted sql

--changeset cemeterymapping:285-create-trinity-b-lots-7-and-12 splitStatements:false
WITH source_lots AS (
  SELECT
    lots.*,
    CASE lots.lot_id
      WHEN '8' THEN '7'
      WHEN '11' THEN '12'
    END AS new_lot_id,
    ST_YMax(Box2D(lots.geometry)) - ST_YMin(Box2D(lots.geometry)) AS lot_height_latitude
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND lots.facility_id = '1'
    AND upper(COALESCE(lots.section_id, '')) = 'B'
    AND lots.lot_id IN ('8', '11')
    AND lots.block_id IS NULL
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
  ST_Translate(geometry, 0, lot_height_latitude)::geometry(MultiPolygon, 4326),
  'standard',
  NULL,
  'operational',
  'Created as an exact northward copy of the adjacent Section B lot with a shared boundary.',
  'estimated',
  'Reviewed Section B lot reconstructed from the southern row footprint.',
  now()
FROM source_lots
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

--rollback DELETE FROM lots WHERE facility_id = '1' AND section_id = 'B' AND lot_id IN ('7', '12') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
