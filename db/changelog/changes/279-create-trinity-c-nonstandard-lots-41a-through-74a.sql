--liquibase formatted sql

--changeset cemeterymapping:279-create-trinity-c-nonstandard-lots-41a-through-74a splitStatements:false
WITH prior_row AS (
  SELECT
    (array_agg(lots.cemetery_id))[1] AS cemetery_id,
    (array_agg(lots.section_uuid))[1] AS section_uuid,
    max(lots.facility_id) AS facility_id,
    max(lots.section_id) AS section_id,
    ST_XMin(ST_Extent(lots.geometry)) AS row_west_longitude,
    ST_XMax(ST_Extent(lots.geometry)) AS row_east_longitude,
    ST_YMax(ST_Extent(lots.geometry)) AS row_south_latitude
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id IN ('73A', '72A', '63', '62', '43A', '42A')
    AND lots.block_id IS NULL
  HAVING count(DISTINCT lots.lot_id) = 6
),
row_bounds AS (
  SELECT
    prior_row.*,
    ST_Y(
      ST_Project(
        ST_SetSRID(ST_MakePoint(prior_row.row_west_longitude, prior_row.row_south_latitude), 4326)::geography,
        16 * 0.3048,
        0
      )::geometry
    ) - prior_row.row_south_latitude AS lot_height_latitude
  FROM prior_row
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      ('74A', 0),
      ('71A', 1),
      ('64', 2),
      ('61', 3),
      ('44A', 4),
      ('41A', 5)
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
  'Created as a six-lot row sharing the northern boundary and column widths of C-73A through C-42A.',
  'estimated',
  CASE
    WHEN lot_id IN ('74A', '71A', '44A', '41A') THEN 'Non-standard Section C lot reconstructed from historic map measurements. The A suffix distinguishes a repeated historic lot number.'
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('74A', '71A', '64', '61', '44A', '41A') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
