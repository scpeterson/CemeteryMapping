--liquibase formatted sql

--changeset cemeterymapping:351-place-c-0392-kaelin-graves-north-of-c-0359 splitStatements:false
--validCheckSum 9:a9a16a815e3b796b3412e05d3a5f9923
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0392' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM gravesites
    WHERE gravesite_id IN ('TLC-GPS-0359', 'TLC-GPS-0392', 'TLC-GPS-0392-01')
      AND geometry IS NOT NULL
      AND deleted_at IS NULL
  ) = 3,
  'active gravesites C-0359, C-0392, and C-0392A with geometry must exist'
);

WITH placement_context AS (
  SELECT
    ST_SetSRID(
      ST_MakePoint(
        ST_XMin(Box2D(geometry)),
        ST_YMax(Box2D(geometry))
      ),
      4326
    ) AS c_0359_north_west_corner
  FROM gravesites
  WHERE gravesite_id = 'TLC-GPS-0359'
    AND deleted_at IS NULL
),
projected_corners AS (
  SELECT
    c_0359_north_west_corner AS elmer_south_west_corner,
    ST_Project(c_0359_north_west_corner::geography, 4 * 0.3048, 0)::geometry AS shared_corner,
    ST_Project(c_0359_north_west_corner::geography, 8 * 0.3048, 0)::geometry AS elizabeth_north_west_corner
  FROM placement_context
),
replacement_geometries AS (
  SELECT
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      elmer_south_west_corner,
      ST_Project(elmer_south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(shared_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      shared_corner,
      elmer_south_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS elmer_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      shared_corner,
      ST_Project(shared_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(elizabeth_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      elizabeth_north_west_corner,
      shared_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS elizabeth_geometry
  FROM projected_corners
),
updated_elmer AS (
  UPDATE gravesites
  SET
    geometry = replacement_geometries.elmer_geometry,
    geometry_source = 'Placed immediately north of C-0359 from field-confirmed Kaelin burial layout; marker TLC-HS-0392 remains fixed.',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Final placement corrected on 2026-08-31: Elmer B Kaelin is immediately north of C-0359 and south of Elizabeth A Kaelin.'
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
  geometry_source = 'Placed north of C-0359 from field-confirmed Kaelin burial layout; marker TLC-HS-0392 remains fixed.',
  geometry_notes = concat_ws(
    ' ', NULLIF(gravesites.geometry_notes, ''),
    'Final placement corrected on 2026-08-31: Elizabeth A Kaelin is north of C-0359 and immediately north of Elmer B Kaelin.'
  ),
  updated_at = now()
FROM replacement_geometries CROSS JOIN updated_elmer
WHERE gravesites.gravesite_id = 'TLC-GPS-0392-01'
  AND gravesites.deleted_at IS NULL;

--rollback empty
