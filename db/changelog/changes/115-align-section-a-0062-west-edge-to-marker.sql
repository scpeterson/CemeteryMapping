--liquibase formatted sql

--changeset cemeterymapping:115-align-section-a-0062-west-edge-to-marker splitStatements:false
WITH aligned_geometry AS (
  SELECT
    gravesites.id AS gravesite_uuid,
    ST_X(headstones.geometry) AS west_longitude,
    ST_Y(headstones.geometry) AS marker_latitude,
    ST_XMax(Box2D(gravesites.geometry)) - ST_XMin(Box2D(gravesites.geometry)) AS width_longitude,
    ST_YMax(Box2D(gravesites.geometry)) - ST_YMin(Box2D(gravesites.geometry)) AS height_latitude
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0062'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.gravesite_id = 'TLC-GPS-0062'
    AND gravesites.deleted_at IS NULL
)
UPDATE gravesites
SET
  geometry = ST_Multi(
    ST_MakeEnvelope(
      aligned_geometry.west_longitude,
      aligned_geometry.marker_latitude - (aligned_geometry.height_latitude / 2.0),
      aligned_geometry.west_longitude + aligned_geometry.width_longitude,
      aligned_geometry.marker_latitude + (aligned_geometry.height_latitude / 2.0),
      4326
    )
  )::geometry(MultiPolygon, 4326),
  geometry_notes = concat_ws(
    ' ',
    NULLIF(gravesites.geometry_notes, ''),
    'Aligned western edge midpoint to associated marker TLC-HS-0062 on 2026-06-19.'
  ),
  updated_at = now()
FROM aligned_geometry
WHERE gravesites.id = aligned_geometry.gravesite_uuid;

--rollback UPDATE gravesites SET geometry = ST_GeomFromText('MULTIPOLYGON(((-80.07995974 40.60119577039333,-80.07992372876716 40.60119577038772,-80.07992372876127 40.601206749601054,-80.07995974 40.601206749606646,-80.07995974 40.60119577039333)))', 4326)::geometry(MultiPolygon, 4326), geometry_notes = NULLIF(replace(COALESCE(geometry_notes, ''), 'Aligned western edge midpoint to associated marker TLC-HS-0062 on 2026-06-19.', ''), ''), updated_at = now() WHERE gravesite_id = 'TLC-GPS-0062';
