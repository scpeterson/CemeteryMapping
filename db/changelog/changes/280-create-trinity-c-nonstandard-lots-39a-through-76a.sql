--liquibase formatted sql

--changeset cemeterymapping:280-create-trinity-c-nonstandard-lots-39a-through-76a splitStatements:false
WITH lot_74a AS (
  SELECT lots.*
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '74A'
    AND lots.block_id IS NULL
  LIMIT 1
),
lot_111 AS (
  SELECT lots.*
  FROM lots
  JOIN lot_74a
    ON lot_74a.facility_id = lots.facility_id
   AND lot_74a.section_id = lots.section_id
  WHERE lots.deleted_at IS NULL
    AND lots.lot_id = '111'
    AND lots.block_id IS NULL
  LIMIT 1
),
anchor_grid AS (
  SELECT
    lot_74a.cemetery_id,
    lot_74a.section_uuid,
    lot_74a.facility_id,
    lot_74a.section_id,
    ST_XMin(Box2D(lot_74a.geometry)) AS row_west_longitude,
    ST_XMax(Box2D(lot_74a.geometry)) - ST_XMin(Box2D(lot_74a.geometry)) AS lot_width_longitude,
    ST_YMin(Box2D(lot_111.geometry)) AS block_south_latitude
  FROM lot_74a
  CROSS JOIN lot_111
),
row_bounds AS (
  SELECT
    anchor_grid.*,
    ST_Y(
      ST_Project(
        ST_SetSRID(ST_MakePoint(anchor_grid.row_west_longitude, anchor_grid.block_south_latitude), 4326)::geography,
        16 * 0.3048,
        0
      )::geometry
    ) AS middle_latitude
  FROM anchor_grid
),
complete_bounds AS (
  SELECT
    row_bounds.*,
    ST_Y(
      ST_Project(
        ST_SetSRID(ST_MakePoint(row_bounds.row_west_longitude, row_bounds.middle_latitude), 4326)::geography,
        16 * 0.3048,
        0
      )::geometry
    ) AS block_north_latitude
  FROM row_bounds
),
lot_sequence AS (
  SELECT *
  FROM (
    VALUES
      ('75A', 0, 0),
      ('70A', 1, 0),
      ('65', 2, 0),
      ('60', 3, 0),
      ('45A', 4, 0),
      ('40A', 5, 0),
      ('76A', 0, 1),
      ('69', 1, 1),
      ('66', 2, 1),
      ('59', 3, 1),
      ('46A', 4, 1),
      ('39A', 5, 1)
  ) AS positioned_lots(lot_id, eastward_offset, northward_offset)
),
new_lots AS (
  SELECT
    complete_bounds.cemetery_id,
    complete_bounds.section_uuid,
    complete_bounds.facility_id,
    complete_bounds.section_id,
    lot_sequence.lot_id,
    ST_Multi(
      ST_MakeEnvelope(
        complete_bounds.row_west_longitude + complete_bounds.lot_width_longitude * lot_sequence.eastward_offset,
        CASE WHEN lot_sequence.northward_offset = 0 THEN complete_bounds.block_south_latitude ELSE complete_bounds.middle_latitude END,
        complete_bounds.row_west_longitude + complete_bounds.lot_width_longitude * (lot_sequence.eastward_offset + 1),
        CASE WHEN lot_sequence.northward_offset = 0 THEN complete_bounds.middle_latitude ELSE complete_bounds.block_north_latitude END,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM complete_bounds
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
  16.36,
  16.00,
  geometry,
  'standard',
  NULL,
  'operational',
  'Created as a two-row, six-column grid aligned west with C-74A and south with C-111, matching the preceding non-standard lot layout.',
  'estimated',
  CASE
    WHEN lot_id IN ('75A', '70A', '45A', '40A', '76A', '46A', '39A') THEN 'Non-standard Section C lot reconstructed from historic map measurements. The A suffix distinguishes a repeated historic lot number.'
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

--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id IN ('75A', '70A', '65', '60', '45A', '40A', '76A', '69', '66', '59', '46A', '39A') AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
