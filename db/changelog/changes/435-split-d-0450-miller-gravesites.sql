--liquibase formatted sql

--changeset cemeterymapping:435-split-d-0450-miller-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0450' AND deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0450' AND geometry IS NOT NULL AND deleted_at IS NULL),
  'active marker TLC-HS-0450 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0450' AND deleted_at IS NULL)
  OR (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(concat_ws(' ', burials.first_name, burials.last_name)) = 'peter miller'
      AND headstones.headstone_id = 'TLC-HS-0450'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(concat_ws(' ', burials.first_name, burials.last_name)) = 'christina miller'
      AND headstones.headstone_id = 'TLC-HS-0450'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1,
  'exactly one linked active Peter Miller burial and one linked active Christina Miller burial must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0450' AND deleted_at IS NULL)
  OR NOT EXISTS (
    SELECT 1 FROM gravesites target
    WHERE target.cemetery_id = (SELECT cemetery_id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0450' AND deleted_at IS NULL)
      AND (target.gravesite_id = 'TLC-GPS-0450-01' OR (target.section_id = 'D' AND target.grave_id = '0450A'))
  ),
  'new gravesite TLC-GPS-0450-01 / D-0450A must be unused'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0450' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM gravesites g JOIN headstones h ON h.gravesite_uuid = g.id
    WHERE g.gravesite_id = 'TLC-GPS-0450' AND g.section_id = 'D' AND g.deleted_at IS NULL
      AND h.headstone_id = 'TLC-HS-0450' AND h.deleted_at IS NULL
      AND (SELECT count(*) FROM burials b WHERE b.gravesite_uuid = g.id AND b.deleted_at IS NULL) = 2
      AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
        WHERE hb.headstone_uuid = h.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
          AND b.gravesite_uuid = g.id AND concat_ws(' ', b.first_name, b.last_name) IN ('Peter Miller', 'Christina Miller')) = 2
  ),
  'both Miller burials and the marker must belong to active Section D gravesite TLC-GPS-0450'
);

WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0450' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0450'
    AND upper(COALESCE(gravesites.section_id, '')) = 'D'
  LIMIT 1
),
projected_corners AS (
  SELECT source_record.*, ST_Project(headstone_point::geography, 0 * 0.3048, pi())::geometry AS shared_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry AS north_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS south_west_corner
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
peter_gravesite AS (
  UPDATE gravesites
  SET name = 'Peter Miller', geometry = replacement_geometries.south_geometry,
    width_feet = 4.00, length_feet = 10.00, geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0450 using fixed marker TLC-HS-0450 as the fixed reference for D-0450 and D-0450A.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Peter Miller retained in original gravesite D-0450 and moved south; Christina Miller was assigned the new grave north of the fixed shared marker on 2026-10-07. The pair consists of 4-by-10-foot estimated operational polygons centered north/south on the unchanged marker at their shared western corner; physical burial limits require field verification; see ADR 0086.'
    ), updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
christina_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, block_uuid, lot_uuid, 'Christina Miller', facility_id,
    section_id, block_id, lot_id, '0450A', 'TLC-GPS-0450-01', cost, north_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0450 using fixed marker TLC-HS-0450 as the fixed reference for D-0450 and D-0450A.',
    'estimated', 'Christina Miller assigned to new gravesite D-0450A immediately north of D-0450 on 2026-10-07. The pair consists of 4-by-10-foot estimated operational polygons centered north/south on the unchanged marker at their shared western corner; physical burial limits require field verification; see ADR 0086.', now()
  FROM peter_gravesite
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    section_uuid = EXCLUDED.section_uuid, block_uuid = EXCLUDED.block_uuid,
    lot_uuid = EXCLUDED.lot_uuid, name = EXCLUDED.name, facility_id = EXCLUDED.facility_id,
    section_id = EXCLUDED.section_id, block_id = EXCLUDED.block_id, lot_id = EXCLUDED.lot_id,
    grave_id = EXCLUDED.grave_id, cost = EXCLUDED.cost, geometry = EXCLUDED.geometry,
    width_feet = EXCLUDED.width_feet, length_feet = EXCLUDED.length_feet,
    status_type_id = EXCLUDED.status_type_id, geometry_type = EXCLUDED.geometry_type,
    geometry_source = EXCLUDED.geometry_source, geometry_confidence = EXCLUDED.geometry_confidence,
    geometry_notes = EXCLUDED.geometry_notes, updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
  RETURNING *
),
marker_context AS (
  SELECT peter_gravesite.id AS peter_gravesite_uuid,
    christina_gravesite.id AS christina_gravesite_uuid, peter_gravesite.headstone_uuid
  FROM peter_gravesite CROSS JOIN christina_gravesite
),
updated_christina_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.christina_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0450-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(concat_ws(' ', burials.first_name, burials.last_name)) = 'christina miller'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, peter_gravesite_uuid, 'primary', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, christina_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type, updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
)
SELECT count(*) AS christina_burials_reassigned FROM updated_christina_burial;

--rollback empty
