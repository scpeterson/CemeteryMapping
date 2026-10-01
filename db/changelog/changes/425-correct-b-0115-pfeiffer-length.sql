--liquibase formatted sql

--changeset cemeterymapping:425-correct-b-0115-pfeiffer-length splitStatements:false
SELECT assert_migration_prerequisite(
  (SELECT count(*) FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0115', 'TLC-GPS-0115-01') AND deleted_at IS NULL) = 2
  AND EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0115' AND geometry IS NOT NULL AND deleted_at IS NULL),
  'both active Pfeiffer gravesites and fixed marker TLC-HS-0115 must exist'
);

WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0115' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0115'
    AND upper(COALESCE(gravesites.section_id, '')) = 'B'
  LIMIT 1
),
projected_corners AS (
  SELECT source_record.*, ST_Project(headstone_point::geography, 2 * 0.3048, pi())::geometry AS shared_west_corner,
    ST_Project(headstone_point::geography, 2 * 0.3048, 0)::geometry AS north_west_corner,
    ST_Project(headstone_point::geography, 6 * 0.3048, pi())::geometry AS south_west_corner
  FROM source_record
),
replacement_geometries AS (
  SELECT projected_corners.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      shared_west_corner,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_west_corner, shared_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_west_corner,
      ST_Project(south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      shared_west_corner, south_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS south_geometry
  FROM projected_corners
),
targets AS (
  SELECT id, south_geometry AS geometry FROM replacement_geometries
  UNION ALL
  SELECT g.id, r.north_geometry FROM replacement_geometries r
  JOIN gravesites g ON g.cemetery_id = r.cemetery_id AND g.gravesite_id = 'TLC-GPS-0115-01' AND g.deleted_at IS NULL
)
UPDATE gravesites g
SET geometry = targets.geometry, width_feet = 4.00, length_feet = 10.00,
  geometry_type = 'operational', geometry_confidence = 'estimated',
  geometry_source = 'Resized Pfeiffer gravesites around fixed marker TLC-HS-0115 per user correction on 2026-10-01.',
  geometry_notes = 'Each gravesite is an estimated 4-by-10-foot operational polygon extending east. Pauline A Pfeiffer in B-0115A is north of Jacob Pfeiffer in B-0115. Shared edge is two feet south of the unchanged marker to fit below B-0116. Supersedes the initial two-foot widths; physical burial limits require field verification. See ADR 0082.',
  updated_at = now()
FROM targets WHERE g.id = targets.id;

--rollback empty
