--liquibase formatted sql

--changeset cemeterymapping:110-align-section-a-gravesites-0038-0045-to-markers splitStatements:false
WITH target_pairs (
  gravesite_id,
  headstone_id
) AS (
  VALUES
    ('TLC-GPS-0038', 'TLC-HS-0038'),
    ('TLC-GPS-0045', 'TLC-HS-0045')
),
aligned_geometries AS (
  SELECT
    gravesites.id AS gravesite_uuid,
    gravesites.gravesite_id,
    headstones.geometry AS marker_geometry,
    ST_X(headstones.geometry) AS east_longitude,
    ST_Y(headstones.geometry) AS marker_latitude,
    ST_XMax(Box2D(gravesites.geometry)) - ST_XMin(Box2D(gravesites.geometry)) AS width_longitude,
    ST_YMax(Box2D(gravesites.geometry)) - ST_YMin(Box2D(gravesites.geometry)) AS height_latitude
  FROM target_pairs
  JOIN gravesites
    ON gravesites.gravesite_id = target_pairs.gravesite_id
   AND gravesites.deleted_at IS NULL
  JOIN headstones
    ON headstones.headstone_id = target_pairs.headstone_id
   AND headstones.deleted_at IS NULL
)
UPDATE gravesites
SET
  geometry = ST_Multi(
    ST_MakeEnvelope(
      aligned_geometries.east_longitude - aligned_geometries.width_longitude,
      aligned_geometries.marker_latitude - (aligned_geometries.height_latitude / 2.0),
      aligned_geometries.east_longitude,
      aligned_geometries.marker_latitude + (aligned_geometries.height_latitude / 2.0),
      4326
    )
  )::geometry(MultiPolygon, 4326),
  geometry_notes = concat_ws(
    ' ',
    NULLIF(gravesites.geometry_notes, ''),
    'Aligned eastern edge midpoint to associated marker geometry on 2026-06-18.'
  ),
  updated_at = now()
FROM aligned_geometries
WHERE gravesites.id = aligned_geometries.gravesite_uuid;

--rollback UPDATE gravesites SET geometry = ST_GeomFromText('MULTIPOLYGON(((-80.0798936 40.601120600393266,-80.0798575888075 40.60112060038765,-80.0798575888016 40.601131579601116,-80.0798936 40.60113157960672,-80.0798936 40.601120600393266)))', 4326)::geometry(MultiPolygon, 4326), geometry_notes = NULLIF(replace(COALESCE(geometry_notes, ''), 'Aligned eastern edge midpoint to associated marker geometry on 2026-06-18.', ''), ''), updated_at = now() WHERE gravesite_id = 'TLC-GPS-0038';
--rollback UPDATE gravesites SET geometry = ST_GeomFromText('MULTIPOLYGON(((-80.07994465 40.60113840039329,-80.07990863879795 40.60113840038768,-80.07990863879205 40.6011493796011,-80.07994465 40.60114937960671,-80.07994465 40.60113840039329)))', 4326)::geometry(MultiPolygon, 4326), geometry_notes = NULLIF(replace(COALESCE(geometry_notes, ''), 'Aligned eastern edge midpoint to associated marker geometry on 2026-06-18.', ''), ''), updated_at = now() WHERE gravesite_id = 'TLC-GPS-0045';
