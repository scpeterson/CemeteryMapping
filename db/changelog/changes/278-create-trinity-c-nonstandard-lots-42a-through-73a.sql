--liquibase formatted sql

--changeset cemeterymapping:278-create-trinity-c-nonstandard-lots-42a-through-73a splitStatements:false
WITH lot_101 AS (
  SELECT
    lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '101'
    AND lots.block_id IS NULL
  LIMIT 1
),
lot_11 AS (
  SELECT lots.*
  FROM lots
  JOIN lot_101
    ON lot_101.facility_id = lots.facility_id
   AND lot_101.section_id = lots.section_id
  WHERE lots.deleted_at IS NULL
    AND lots.lot_id = '11'
    AND lots.block_id IS NULL
  LIMIT 1
),
anchors AS (
  SELECT
    lot_101.cemetery_id,
    lot_101.section_uuid,
    lot_101.facility_id,
    lot_101.section_id,
    ST_XMax(Box2D(lot_101.geometry)) AS c_101_east_longitude,
    ST_XMax(Box2D(lot_11.geometry)) AS c_11_east_longitude,
    ST_YMin(Box2D(lot_101.geometry)) AS row_south_latitude
  FROM lot_101
  CROSS JOIN lot_11
),
row_bounds AS (
  SELECT
    anchors.*,
    ST_X(
      ST_Project(
        ST_SetSRID(ST_MakePoint(anchors.c_101_east_longitude, anchors.row_south_latitude), 4326)::geography,
        3 * 0.3048,
        pi() / 2
      )::geometry
    ) AS row_west_longitude,
    ST_X(
      ST_Project(
        ST_SetSRID(ST_MakePoint(anchors.c_11_east_longitude, anchors.row_south_latitude), 4326)::geography,
        1 * 0.3048,
        3 * pi() / 2
      )::geometry
    ) AS row_east_longitude,
    ST_Y(
      ST_Project(
        ST_SetSRID(ST_MakePoint(anchors.c_101_east_longitude, anchors.row_south_latitude), 4326)::geography,
        16 * 0.3048,
        0
      )::geometry
    ) - anchors.row_south_latitude AS lot_height_latitude
  FROM anchors
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      ('73A', 0),
      ('72A', 1),
      ('63', 2),
      ('62', 3),
      ('43A', 4),
      ('42A', 5)
  ) AS positioned_lots(lot_id, eastward_offset)
),
new_lots AS (
  SELECT
    row_bounds.cemetery_id,
    row_bounds.section_uuid,
    row_bounds.facility_id,
    row_bounds.section_id,
    lot_sequence.lot_id,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(row_bounds.row_west_longitude, row_bounds.row_south_latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(row_bounds.row_east_longitude, row_bounds.row_south_latitude), 4326)::geography
    ) / 0.3048 / 6 AS lot_width_feet,
    ST_Multi(
      ST_MakeEnvelope(
        row_bounds.row_west_longitude + (row_bounds.row_east_longitude - row_bounds.row_west_longitude) * lot_sequence.eastward_offset / 6,
        row_bounds.row_south_latitude,
        row_bounds.row_west_longitude + (row_bounds.row_east_longitude - row_bounds.row_west_longitude) * (lot_sequence.eastward_offset + 1) / 6,
        row_bounds.row_south_latitude + row_bounds.lot_height_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM row_bounds
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
  'C-' || lot_id,
  facility_id,
  section_id,
  NULL,
  lot_id,
  round(lot_width_feet::numeric, 2),
  16.00,
  geometry,
  'standard',
  NULL,
  'operational',
  'Created as six equal lots between offsets 3 feet east of C-101 and 1 foot west of the C-11 eastern edge, aligned with the C-101 southern edge.',
  'estimated',
  CASE
    WHEN lot_id IN ('73A', '72A', '43A', '42A') THEN 'Non-standard Section C lot reconstructed from historic map measurements. The A suffix distinguishes a repeated historic lot number.'
    ELSE 'Non-standard Section C lot reconstructed from historic map measurements.'
  END,
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('73A', '72A', '63', '62', '43A', '42A') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
