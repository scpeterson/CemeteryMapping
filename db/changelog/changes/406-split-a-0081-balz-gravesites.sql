--liquibase formatted sql

--changeset cemeterymapping:406-split-a-0081-balz-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0081' AND deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0081' AND geometry IS NOT NULL AND deleted_at IS NULL),
  'active marker TLC-HS-0081 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0081' AND deleted_at IS NULL)
  OR (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(concat_ws(' ', burials.first_name, burials.last_name)) = 'william j balz'
      AND headstones.headstone_id = 'TLC-HS-0081'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(concat_ws(' ', burials.first_name, burials.last_name)) = 'charlotte m balz'
      AND headstones.headstone_id = 'TLC-HS-0081'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1,
  'exactly one linked active William J Balz burial and one linked active Charlotte M Balz burial must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0081' AND deleted_at IS NULL)
  OR NOT EXISTS (
    SELECT 1 FROM gravesites target
    WHERE target.cemetery_id = (SELECT cemetery_id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0081' AND deleted_at IS NULL)
      AND (target.gravesite_id = 'TLC-GPS-0081-01' OR (target.section_id = 'A' AND target.grave_id = '0081A'))
  ),
  'new gravesite TLC-GPS-0081-01 / A-0081A must be unused'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0081' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM gravesites g JOIN headstones h ON h.gravesite_uuid = g.id
    WHERE g.gravesite_id = 'TLC-GPS-0081' AND g.section_id = 'A' AND g.deleted_at IS NULL
      AND h.headstone_id = 'TLC-HS-0081' AND h.deleted_at IS NULL
      AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
        WHERE hb.headstone_uuid = h.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
          AND b.gravesite_uuid = g.id AND concat_ws(' ', b.first_name, b.last_name) IN ('William J Balz', 'Charlotte M Balz')) = 2
  ),
  'both Balz burials and the marker must belong to active Section A gravesite TLC-GPS-0081'
);

WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0081' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0081'
    AND upper(COALESCE(gravesites.section_id, '')) = 'A'
  LIMIT 1
),
projected_corners AS (
  SELECT source_record.*, headstone_point AS shared_west_corner,
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
william_gravesite AS (
  UPDATE gravesites
  SET name = 'William J Balz', geometry = replacement_geometries.south_geometry,
    width_feet = 4.00, length_feet = 10.00, geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0081 using fixed marker TLC-HS-0081 as the boundary between A-0081 and A-0081A.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'William J Balz retained in original gravesite A-0081 and moved south; Charlotte M Balz was assigned the new grave north of the fixed shared marker on 2026-09-17. Estimated overlaps with neighboring gravesites require field review; see ADR 0067.'
    ), updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
charlotte_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, block_uuid, lot_uuid, 'Charlotte M Balz', facility_id,
    section_id, block_id, lot_id, '0081A', 'TLC-GPS-0081-01', cost, north_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0081 using fixed marker TLC-HS-0081 as the boundary between A-0081 and A-0081A.',
    'estimated', 'Charlotte M Balz assigned to new gravesite A-0081A immediately north of A-0081 on 2026-09-17. Estimated overlaps with neighboring gravesites require field review; see ADR 0067.', now()
  FROM william_gravesite
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
  SELECT william_gravesite.id AS william_gravesite_uuid,
    charlotte_gravesite.id AS charlotte_gravesite_uuid, william_gravesite.headstone_uuid
  FROM william_gravesite CROSS JOIN charlotte_gravesite
),
updated_william_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.william_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0081', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(concat_ws(' ', burials.first_name, burials.last_name)) = 'william j balz'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
updated_charlotte_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.charlotte_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0081-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(concat_ws(' ', burials.first_name, burials.last_name)) = 'charlotte m balz'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, william_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, charlotte_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_william_burial.id
  FROM marker_context CROSS JOIN updated_william_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_charlotte_burial.id
  FROM marker_context CROSS JOIN updated_charlotte_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.william_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
