--liquibase formatted sql

--changeset cemeterymapping:111-correct-section-a-gravesites-0038-0045-west-edge-marker-alignment splitStatements:false
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
    ST_X(headstones.geometry) AS west_longitude,
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
      aligned_geometries.west_longitude,
      aligned_geometries.marker_latitude - (aligned_geometries.height_latitude / 2.0),
      aligned_geometries.west_longitude + aligned_geometries.width_longitude,
      aligned_geometries.marker_latitude + (aligned_geometries.height_latitude / 2.0),
      4326
    )
  )::geometry(MultiPolygon, 4326),
  geometry_notes = concat_ws(
    ' ',
    NULLIF(
      replace(
        COALESCE(gravesites.geometry_notes, ''),
        'Aligned eastern edge midpoint to associated marker geometry on 2026-06-18.',
        ''
      ),
      ''
    ),
    'Corrected alignment so western edge midpoint is on associated marker geometry on 2026-06-18.'
  ),
  updated_at = now()
FROM aligned_geometries
WHERE gravesites.id = aligned_geometries.gravesite_uuid;

--rollback UPDATE gravesites SET geometry = ST_GeomFromText('MULTIPOLYGON(((-80.07989216782912 40.6011015191654,-80.07989216782912 40.60111249838447,-80.07985615663071 40.60111249838447,-80.07985615663071 40.6011015191654,-80.07989216782912 40.6011015191654)))', 4326)::geometry(MultiPolygon, 4326), geometry_notes = concat_ws(' ', NULLIF(replace(COALESCE(geometry_notes, ''), 'Corrected alignment so western edge midpoint is on associated marker geometry on 2026-06-18.', ''), ''), 'Aligned eastern edge midpoint to associated marker geometry on 2026-06-18.'), updated_at = now() WHERE gravesite_id = 'TLC-GPS-0038';
--rollback UPDATE gravesites SET geometry = ST_GeomFromText('MULTIPOLYGON(((-80.07992951483297 40.60112537916661,-80.07992951483297 40.60113635838564,-80.07989350362502 40.60113635838564,-80.07989350362502 40.60112537916661,-80.07992951483297 40.60112537916661)))', 4326)::geometry(MultiPolygon, 4326), geometry_notes = concat_ws(' ', NULLIF(replace(COALESCE(geometry_notes, ''), 'Corrected alignment so western edge midpoint is on associated marker geometry on 2026-06-18.', ''), ''), 'Aligned eastern edge midpoint to associated marker geometry on 2026-06-18.'), updated_at = now() WHERE gravesite_id = 'TLC-GPS-0045';
