--liquibase formatted sql

--changeset cemeterymapping:222-fit-c-0192-through-c-0194-into-lot-72 splitStatements:false
WITH target_lot AS (
  SELECT
    lots.*,
    ST_XMin(Box2D(lots.geometry)) AS west_longitude,
    ST_XMax(Box2D(lots.geometry)) AS east_longitude,
    ST_YMin(Box2D(lots.geometry)) AS south_latitude,
    ST_YMax(Box2D(lots.geometry)) AS north_latitude
  FROM lots
  WHERE lots.deleted_at IS NULL
    AND upper(COALESCE(lots.section_id, '')) = 'C'
    AND lots.lot_id = '72'
    AND lots.block_id IS NULL
),
lot_slices AS (
  SELECT
    id AS lot_uuid,
    geometry AS lot_geometry,
    lot_id,
    (north_latitude - south_latitude) / 5 AS grave_height,
    west_longitude,
    east_longitude,
    south_latitude
  FROM target_lot
),
target_gravesites(gravesite_id, grave_id, sort_order, geometry_notes) AS (
  VALUES
    ('TLC-GPS-0192-02', '0192B', 0, 'Albert R Will assigned to the southernmost gravesite in lot C-72.'),
    ('TLC-GPS-0192-01', '0192A', 1, 'Elva Z Will assigned immediately north of C-0192B in lot C-72.'),
    ('TLC-GPS-0193', '0193', 3, 'George W Will assigned immediately south of C-0194 in lot C-72.'),
    ('TLC-GPS-0194', '0194', 4, 'Ida V Will assigned to the northernmost gravesite in lot C-72.')
),
replacement_geometries AS (
  SELECT
    target_gravesites.gravesite_id,
    target_gravesites.grave_id,
    target_gravesites.geometry_notes,
    lot_slices.lot_uuid,
    lot_slices.lot_id,
    ST_Multi(
      ST_CollectionExtract(
        ST_Intersection(
          ST_MakeEnvelope(
            lot_slices.west_longitude,
            lot_slices.south_latitude + lot_slices.grave_height * target_gravesites.sort_order,
            lot_slices.east_longitude,
            lot_slices.south_latitude + lot_slices.grave_height * (target_gravesites.sort_order + 1),
            4326
          ),
          lot_slices.lot_geometry
        ),
        3
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM target_gravesites
  CROSS JOIN lot_slices
)
UPDATE gravesites
SET
  lot_uuid = replacement_geometries.lot_uuid,
  lot_id = replacement_geometries.lot_id,
  grave_id = replacement_geometries.grave_id,
  geometry = replacement_geometries.geometry,
  width_feet = 4.00,
  length_feet = 10.00,
  geometry_type = 'operational',
  geometry_source = 'Fit into lot C-72 using top and bottom grave pairs clipped to the lot polygon; marker GPS positions intentionally unchanged.',
  geometry_confidence = 'estimated',
  geometry_notes = concat_ws(
    ' ',
    NULLIF(gravesites.geometry_notes, ''),
    replacement_geometries.geometry_notes,
    'Gravesite geometry was fit to lot C-72 on 2026-07-08; associated marker locations were not moved.'
  ),
  updated_at = now()
FROM replacement_geometries
WHERE gravesites.deleted_at IS NULL
  AND gravesites.gravesite_id = replacement_geometries.gravesite_id
  AND upper(COALESCE(gravesites.section_id, '')) = 'C';

--rollback UPDATE gravesites SET lot_uuid = NULL, lot_id = NULL, updated_at = now() WHERE gravesites.gravesite_id IN ('TLC-GPS-0192-01', 'TLC-GPS-0192-02', 'TLC-GPS-0193', 'TLC-GPS-0194') AND lot_id = '72';
