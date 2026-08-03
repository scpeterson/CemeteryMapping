--liquibase formatted sql

--changeset cemeterymapping:281-create-trinity-b-lot-8 splitStatements:false
WITH lot_a_1 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND lots.facility_id = '1'
    AND upper(COALESCE(lots.section_id, '')) = 'A'
    AND lots.lot_id = '1'
    AND lots.block_id IS NULL
  LIMIT 1
),
lot_c_42a AS (
  SELECT lots.*
  FROM lots
  JOIN lot_a_1 ON lot_a_1.cemetery_id = lots.cemetery_id
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '42A'
    AND lots.block_id IS NULL
  LIMIT 1
),
grave_b_0095 AS (
  SELECT gravesites.*
  FROM gravesites
  JOIN lot_a_1 ON lot_a_1.cemetery_id = gravesites.cemetery_id
  WHERE gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'B'
    AND gravesites.grave_id = '0095'
    AND gravesites.gravesite_id = 'TLC-GPS-0095'
  LIMIT 1
),
anchors AS (
  SELECT
    grave_b_0095.cemetery_id,
    grave_b_0095.section_uuid,
    grave_b_0095.facility_id,
    grave_b_0095.section_id,
    lot_c_42a.width_feet,
    lot_c_42a.length_feet,
    ST_XMax(Box2D(lot_a_1.geometry)) AS east_longitude,
    ST_XMax(Box2D(lot_c_42a.geometry)) - ST_XMin(Box2D(lot_c_42a.geometry)) AS lot_width_longitude,
    ST_Y(
      ST_Project(
        ST_SetSRID(
          ST_MakePoint(
            ST_XMax(Box2D(lot_a_1.geometry)),
            ST_YMin(Box2D(grave_b_0095.geometry))
          ),
          4326
        )::geography,
        3 * 0.3048,
        pi()
      )::geometry
    ) AS south_latitude
  FROM lot_a_1
  CROSS JOIN lot_c_42a
  CROSS JOIN grave_b_0095
),
new_lot AS (
  SELECT
    anchors.*,
    ST_Y(
      ST_Project(
        ST_SetSRID(
          ST_MakePoint(
            anchors.east_longitude - anchors.lot_width_longitude,
            anchors.south_latitude
          ),
          4326
        )::geography,
        anchors.length_feet * 0.3048,
        0
      )::geometry
    ) AS north_latitude
  FROM anchors
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
  'B-8',
  facility_id,
  section_id,
  NULL,
  '8',
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
  'Created from the C-42A footprint, aligned east with A-1 and positioned 3 feet south of gravesite B-0095.',
  'estimated',
  'Reviewed Section B lot reconstructed from measured neighboring geometry.',
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

--rollback DELETE FROM lots WHERE facility_id = '1' AND section_id = 'B' AND lot_id = '8' AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
