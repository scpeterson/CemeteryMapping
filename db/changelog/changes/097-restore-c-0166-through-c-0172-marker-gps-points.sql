--liquibase formatted sql

--changeset cemeterymapping:097-restore-c-0166-through-c-0172-marker-gps-points splitStatements:false
WITH imported_marker_points AS (
  SELECT
    headstones.id,
    (headstones.source_properties ->> 'Longitude')::numeric AS imported_longitude,
    (headstones.source_properties ->> 'Latitude')::numeric AS imported_latitude
  FROM headstones
  WHERE headstones.deleted_at IS NULL
    AND headstones.headstone_id IN (
      'TLC-HS-0166',
      'TLC-HS-0167',
      'TLC-HS-0168',
      'TLC-HS-0169',
      'TLC-HS-0170',
      'TLC-HS-0171',
      'TLC-HS-0172'
    )
    AND headstones.source_properties ->> 'Longitude' IS NOT NULL
    AND headstones.source_properties ->> 'Latitude' IS NOT NULL
)
UPDATE headstones
SET
  geometry = ST_SetSRID(ST_MakePoint(imported_marker_points.imported_longitude, imported_marker_points.imported_latitude), 4326)::geometry(Point, 4326),
  longitude = imported_marker_points.imported_longitude,
  latitude = imported_marker_points.imported_latitude,
  updated_at = now()
FROM imported_marker_points
WHERE headstones.id = imported_marker_points.id;

--rollback empty
