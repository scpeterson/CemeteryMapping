--liquibase formatted sql

--changeset cemeterymapping:352-place-c-0392a-north-of-c-0392 splitStatements:false
--validCheckSum 9:16a7f3391df07597cd8022ae10af6692
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0392' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM gravesites
    WHERE gravesite_id IN ('TLC-GPS-0392', 'TLC-GPS-0392-01')
      AND geometry IS NOT NULL
      AND deleted_at IS NULL
  ) = 2
  AND EXISTS (
    SELECT 1 FROM headstones
    WHERE headstone_id = 'TLC-HS-0392'
      AND geometry IS NOT NULL
      AND deleted_at IS NULL
  ),
  'active gravesites C-0392 and C-0392A and fixed marker TLC-HS-0392 must exist'
);

WITH marker_context AS (
  SELECT
    ST_SetSRID(geometry, 4326) AS shared_west_corner,
    ST_Project(ST_SetSRID(geometry, 4326)::geography, 4 * 0.3048, 0)::geometry AS north_west_corner,
    ST_Project(ST_SetSRID(geometry, 4326)::geography, 4 * 0.3048, pi())::geometry AS south_west_corner
  FROM headstones
  WHERE headstone_id = 'TLC-HS-0392'
    AND deleted_at IS NULL
),
replacement_geometries AS (
  SELECT
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_west_corner,
      ST_Project(south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      shared_west_corner,
      south_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS elmer_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      shared_west_corner,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_west_corner,
      shared_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS elizabeth_geometry
  FROM marker_context
),
updated_elmer AS (
  UPDATE gravesites
  SET
    geometry = replacement_geometries.elmer_geometry,
    geometry_source = 'Corrected placement using fixed marker TLC-HS-0392 as the boundary between C-0392 and C-0392A.',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Reference correction on 2026-08-31: C-0392 is south of C-0392A; the earlier C-0359-relative placement was based on a mistaken reference gravesite.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.gravesite_id = 'TLC-GPS-0392'
    AND gravesites.deleted_at IS NULL
  RETURNING gravesites.id
)
UPDATE gravesites
SET
  geometry = replacement_geometries.elizabeth_geometry,
  geometry_source = 'Placed immediately north of C-0392 using fixed marker TLC-HS-0392 as the shared boundary.',
  geometry_notes = concat_ws(
    ' ', NULLIF(gravesites.geometry_notes, ''),
    'Reference correction on 2026-08-31: Elizabeth A Kaelin in C-0392A is immediately north of Elmer B Kaelin in C-0392.'
  ),
  updated_at = now()
FROM replacement_geometries CROSS JOIN updated_elmer
WHERE gravesites.gravesite_id = 'TLC-GPS-0392-01'
  AND gravesites.deleted_at IS NULL;

--rollback empty
