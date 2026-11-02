--liquibase formatted sql

--changeset cemeterymapping:506-infer-monument-bearings-from-gravesites splitStatements:false
WITH linked AS (
  SELECT h.id AS headstone_uuid, g.gravesite_id, g.geometry
  FROM headstones h
  JOIN headstone_gravesites hg
    ON hg.headstone_uuid = h.id
   AND hg.deleted_at IS NULL
   AND hg.relationship_type = 'primary'
  JOIN gravesites g
    ON g.id = hg.gravesite_uuid
   AND g.deleted_at IS NULL
  WHERE h.deleted_at IS NULL
    AND NOT jsonb_exists(COALESCE(h.source_properties, '{}'::jsonb), 'MonumentOrientation')
    AND NOT EXISTS (
      SELECT 1
      FROM headstone_gravesites hg2
      WHERE hg2.headstone_uuid = h.id
        AND hg2.deleted_at IS NULL
        AND hg2.relationship_type = 'primary'
        AND hg2.gravesite_uuid <> hg.gravesite_uuid
    )
), corners AS (
  SELECT headstone_uuid, gravesite_id,
    ST_PointN(ring, 1) AS p1, ST_PointN(ring, 2) AS p2,
    ST_PointN(ring, 3) AS p3, ST_PointN(ring, 4) AS p4
  FROM (
    SELECT headstone_uuid, gravesite_id,
      ST_ExteriorRing(ST_GeometryN(geometry, 1)) AS ring
    FROM linked
    WHERE ST_GeometryType(geometry) = 'ST_MultiPolygon'
      AND ST_IsValid(geometry)
      AND ST_NumGeometries(geometry) = 1
      AND ST_NPoints(ST_ExteriorRing(ST_GeometryN(geometry, 1))) = 5
  ) source
), measured AS (
  SELECT *,
    ST_Distance(p1::geography, p2::geography) AS e12,
    ST_Distance(p2::geography, p3::geography) AS e23,
    ST_Distance(p3::geography, p4::geography) AS e34,
    ST_Distance(p4::geography, p1::geography) AS e41,
    degrees(ST_Azimuth(p1::geography, p2::geography)) AS a12,
    degrees(ST_Azimuth(p2::geography, p3::geography)) AS a23
  FROM corners
), candidates AS (
  SELECT headstone_uuid, gravesite_id,
    CASE WHEN e12 >= e23 THEN a12 ELSE a23 END AS raw_bearing,
    GREATEST(e12, e34) / NULLIF(LEAST(e12, e34), 0) AS long_ratio,
    GREATEST(e23, e41) / NULLIF(LEAST(e23, e41), 0) AS short_ratio,
    CASE WHEN e12 >= e23 THEN e12 ELSE e23 END AS long_edge,
    CASE WHEN e12 >= e23 THEN e23 ELSE e12 END AS short_edge
  FROM measured
), reliable AS (
  SELECT headstone_uuid, gravesite_id,
    CASE
      WHEN mod((raw_bearing + 360)::numeric, 360) >= 180 THEN mod((raw_bearing + 360)::numeric, 360) - 180
      ELSE mod((raw_bearing + 360)::numeric, 360)
    END AS bearing
  FROM candidates
  WHERE long_ratio <= 1.05
    AND short_ratio <= 1.05
    AND long_edge > short_edge
    AND long_edge / NULLIF(short_edge, 0) >= 1.5
)
UPDATE headstones h
SET source_properties = COALESCE(h.source_properties, '{}'::jsonb)
  || jsonb_build_object(
    'MonumentOrientation', jsonb_build_object(
      'bearingDegrees', round(reliable.bearing::numeric, 1),
      'source', 'Derived from associated gravesite geometry',
      'inferred', true,
      'reviewStatus', 'needs_review',
      'gravesiteId', reliable.gravesite_id
    )
  ),
  updated_at = now()
FROM reliable
WHERE h.id = reliable.headstone_uuid
  AND NOT jsonb_exists(COALESCE(h.source_properties, '{}'::jsonb), 'MonumentOrientation');

--rollback UPDATE headstones SET source_properties = source_properties - 'MonumentOrientation', updated_at = now() WHERE source_properties->'MonumentOrientation'->>'source' = 'Derived from associated gravesite geometry';
