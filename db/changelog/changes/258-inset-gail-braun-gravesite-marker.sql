--liquibase formatted sql

--changeset cemeterymapping:258-inset-gail-braun-gravesite-marker splitStatements:false
WITH marker AS (
  SELECT
    geometry AS marker_geometry,
    ST_Project(geometry::geography, 0.20, 3 * pi() / 2)::geometry AS west_center
  FROM headstones
  WHERE headstone_id = 'TLC-HS-0267A'
    AND deleted_at IS NULL
  LIMIT 1
),
replacement AS (
  SELECT
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            ST_Project(west_center::geography, 2 * 0.3048, pi())::geometry,
            ST_Project(
              ST_Project(west_center::geography, 2 * 0.3048, pi()),
              10 * 0.3048,
              pi() / 2
            )::geometry,
            ST_Project(
              ST_Project(west_center::geography, 2 * 0.3048, 0),
              10 * 0.3048,
              pi() / 2
            )::geometry,
            ST_Project(west_center::geography, 2 * 0.3048, 0)::geometry,
            ST_Project(west_center::geography, 2 * 0.3048, pi())::geometry
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM marker
)
UPDATE gravesites
SET
  geometry = replacement.geometry,
  geometry_source = 'Estimated from field photo IMG_5342.HEIC, iPhone EXIF GPS, and interpolation between TLC-HS-0267 and TLC-HS-0268; polygon inset west around the fixed marker point.',
  geometry_notes = 'Placed between C-0267 (Alice N Matters) and C-0268 (George R Dunbar). The marker uses the row midpoint; the gravesite polygon starts 0.20 m west of the marker to avoid overlap with estimated C-0161A geometry. Raw iPhone GPS reported approximately 4.97 m horizontal uncertainty.',
  updated_at = now()
FROM replacement
WHERE gravesites.gravesite_id = 'TLC-GPS-0267-01'
  AND gravesites.deleted_at IS NULL;

--rollback empty
