--liquibase formatted sql

--changeset cemeterymapping:082-restore-c-0174-through-c-0177-marker-gps-points splitStatements:false
WITH gps_marker_points AS (
  SELECT *
  FROM (
    VALUES
      ('TLC-HS-0174', -80.08015414::numeric, 40.60107214::numeric),
      ('TLC-HS-0175', -80.08015244::numeric, 40.60108814::numeric),
      ('TLC-HS-0176', -80.08015265::numeric, 40.60110701::numeric),
      ('TLC-HS-0177', -80.08015476::numeric, 40.60111606::numeric)
  ) AS restored_points(headstone_id, longitude, latitude)
)
UPDATE headstones
SET
  geometry = ST_SetSRID(ST_MakePoint(gps_marker_points.longitude, gps_marker_points.latitude), 4326)::geometry(Point, 4326),
  longitude = gps_marker_points.longitude,
  latitude = gps_marker_points.latitude,
  updated_at = now()
FROM gps_marker_points
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id = gps_marker_points.headstone_id;

--rollback empty
