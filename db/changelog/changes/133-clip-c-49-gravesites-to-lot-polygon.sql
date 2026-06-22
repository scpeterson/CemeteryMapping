--liquibase formatted sql

--changeset cemeterymapping:133-clip-c-49-gravesites-to-lot-polygon splitStatements:false
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
    AND lots.lot_id = '49'
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
target_gravesites(gravesite_id, grave_id, sort_order) AS (
  VALUES
    ('TLC-GPS-0195', '0195', 0),
    ('TLC-GPS-0196', '0196', 1),
    ('TLC-GPS-0197', '0197', 2),
    ('TLC-GPS-0198-02', '0198B', 3),
    ('TLC-GPS-0198-01', '0198A', 4)
),
replacement_geometries AS (
  SELECT
    target_gravesites.gravesite_id,
    target_gravesites.grave_id,
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
  geometry_source = 'Fit into lot C-49 as one of five stacked gravesites clipped to the lot polygon; marker GPS positions intentionally unchanged.',
  geometry_confidence = 'estimated',
  geometry_notes = concat_ws(
    ' ',
    NULLIF(gravesites.geometry_notes, ''),
    'C-49 fitted gravesite geometry clipped to the lot polygon on 2026-06-22 to keep all five gravesites inside the lot.'
  ),
  updated_at = now()
FROM replacement_geometries
WHERE gravesites.deleted_at IS NULL
  AND gravesites.gravesite_id = replacement_geometries.gravesite_id
  AND upper(COALESCE(gravesites.section_id, '')) = 'C';

--rollback empty
