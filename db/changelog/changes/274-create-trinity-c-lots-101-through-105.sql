--liquibase formatted sql

--changeset cemeterymapping:274-create-trinity-c-lots-101-through-105 splitStatements:false
WITH lot_100 AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '100'
    AND lots.block_id IS NULL
  LIMIT 1
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      ('105', 0, 'non_burial', 'Lot exists in the cemetery lot grid, but it cannot contain gravesites or markers.'),
      ('104', 1, 'standard', NULL),
      ('103', 2, 'standard', NULL),
      ('102', 3, 'standard', NULL),
      ('101', 4, 'standard', NULL)
  ) AS positioned_lots(lot_id, eastward_offset, burial_use_status, burial_use_notes)
),
anchor_grid AS (
  SELECT
    lot_100.*,
    ST_XMin(Box2D(lot_100.geometry)) AS west_longitude,
    ST_XMax(Box2D(lot_100.geometry)) AS east_longitude,
    ST_YMax(Box2D(lot_100.geometry)) AS north_latitude,
    ST_XMax(Box2D(lot_100.geometry)) - ST_XMin(Box2D(lot_100.geometry)) AS lot_width_longitude,
    ST_YMax(Box2D(lot_100.geometry)) - ST_YMin(Box2D(lot_100.geometry)) AS lot_height_latitude,
    ST_X(
      ST_Project(
        ST_SetSRID(
          ST_MakePoint(
            ST_XMin(Box2D(lot_100.geometry)),
            ST_YMax(Box2D(lot_100.geometry))
          ),
          4326
        )::geography,
        2 * 0.3048,
        3 * pi() / 2
      )::geometry
    ) - ST_XMin(Box2D(lot_100.geometry)) AS west_shift_longitude,
    ST_Y(
      ST_Project(
        ST_SetSRID(
          ST_MakePoint(
            ST_XMin(Box2D(lot_100.geometry)),
            ST_YMax(Box2D(lot_100.geometry))
          ),
          4326
        )::geography,
        6 * 0.3048,
        0
      )::geometry
    ) - ST_YMax(Box2D(lot_100.geometry)) AS aisle_height_latitude
  FROM lot_100
),
new_lots AS (
  SELECT
    anchor_grid.cemetery_id,
    anchor_grid.section_uuid,
    anchor_grid.facility_id,
    anchor_grid.section_id,
    lot_sequence.lot_id,
    lot_sequence.burial_use_status,
    lot_sequence.burial_use_notes,
    ST_Multi(
      ST_MakeEnvelope(
        anchor_grid.west_longitude + anchor_grid.west_shift_longitude + anchor_grid.lot_width_longitude * lot_sequence.eastward_offset,
        anchor_grid.north_latitude + anchor_grid.aisle_height_latitude,
        anchor_grid.east_longitude + anchor_grid.west_shift_longitude + anchor_grid.lot_width_longitude * lot_sequence.eastward_offset,
        anchor_grid.north_latitude + anchor_grid.aisle_height_latitude + anchor_grid.lot_height_latitude,
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
  10.00,
  20.00,
  geometry,
  burial_use_status,
  burial_use_notes,
  'operational',
  'Created from the WGS-aligned C-100 grid with a 6-foot north aisle, matching eastward lot spacing, and a 2-foot westward row offset.',
  'estimated',
  CASE
    WHEN lot_id = '105' THEN 'C-105 is north of C-100, shifted 2 feet west with the new row, and cannot contain gravesites or markers.'
    ELSE 'New Section C lot in the row north of C-96 through C-100.'
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('101', '102', '103', '104', '105') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
