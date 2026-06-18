--liquibase formatted sql

--changeset cemeterymapping:107-correct-reviewed-shapefile-marker-associations splitStatements:false
WITH reviewed_updates (
  headstone_id,
  longitude,
  latitude,
  match_confidence,
  match_reasons,
  distance_feet,
  shapefile_feature_index,
  shapefile_title,
  shapefile_name
) AS (
  VALUES
    ('TLC-HS-0038', -80.07985615663071::numeric, 40.60110700877493::numeric, 'manual_correction', 'name|manual_review', 7.680140::numeric, 94::integer, '96', 'James H Crea; Ella R Pfeiffer'),
    ('TLC-HS-0045', -80.07989350362502::numeric, 40.601130868776124::numeric, 'manual_correction', 'name|manual_review', 1.743565::numeric, 98::integer, '100', 'Robert G Scott')
)
UPDATE headstones
SET
  longitude = reviewed_updates.longitude,
  latitude = reviewed_updates.latitude,
  geometry = ST_SetSRID(
    ST_MakePoint(reviewed_updates.longitude::double precision, reviewed_updates.latitude::double precision),
    4326
  )::geometry(Point, 4326),
  source_properties = jsonb_set(
    headstones.source_properties,
    '{ShapefileGeometryUpdate}',
    jsonb_build_object(
      'source', 'TrinityCemeteryFinal3.shp',
      'coordinateSource', 'shapefile geometry',
      'reviewedBy', 'manual correction after duplicate shapefile feature review',
      'reviewedAt', '2026-06-18',
      'matchConfidence', reviewed_updates.match_confidence,
      'matchReasons', reviewed_updates.match_reasons,
      'distanceFeet', reviewed_updates.distance_feet,
      'shapefileFeatureIndex', reviewed_updates.shapefile_feature_index,
      'shapefileTitle', reviewed_updates.shapefile_title,
      'shapefileName', reviewed_updates.shapefile_name,
      'previousLongitude', ST_X(headstones.geometry),
      'previousLatitude', ST_Y(headstones.geometry),
      'correctionReason', 'Feature 113 Florence B Kind should only be associated with TLC-HS-0059; TLC-HS-0045 should be associated with Robert G Scott.'
    ),
    true
  ),
  updated_at = now()
FROM reviewed_updates
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id = reviewed_updates.headstone_id;

--rollback WITH previous_points AS (SELECT headstones.id, (headstones.source_properties #>> '{ShapefileGeometryUpdate,previousLongitude}')::double precision AS longitude, (headstones.source_properties #>> '{ShapefileGeometryUpdate,previousLatitude}')::double precision AS latitude FROM headstones WHERE headstones.headstone_id IN ('TLC-HS-0038', 'TLC-HS-0045') AND headstones.source_properties #> '{ShapefileGeometryUpdate}' IS NOT NULL) UPDATE headstones SET longitude = previous_points.longitude, latitude = previous_points.latitude, geometry = ST_SetSRID(ST_MakePoint(previous_points.longitude, previous_points.latitude), 4326)::geometry(Point, 4326), updated_at = now() FROM previous_points WHERE headstones.id = previous_points.id;
