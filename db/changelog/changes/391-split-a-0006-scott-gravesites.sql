--liquibase formatted sql

--changeset cemeterymapping:391-split-a-0006-scott-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0006' AND deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0006' AND geometry IS NOT NULL AND deleted_at IS NULL),
  'active marker TLC-HS-0006 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0006' AND deleted_at IS NULL)
  OR (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(COALESCE(burials.full_name, '')) = 'herb scott'
      AND headstones.headstone_id = 'TLC-HS-0006'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(COALESCE(burials.full_name, '')) = 'patricia scott'
      AND headstones.headstone_id = 'TLC-HS-0006'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1,
  'exactly one linked active Herb Scott burial and one linked active Patricia Scott burial must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0006' AND deleted_at IS NULL)
  OR NOT EXISTS (
    SELECT 1 FROM gravesites target
    WHERE target.cemetery_id = (SELECT cemetery_id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0006' AND deleted_at IS NULL)
      AND (target.gravesite_id = 'TLC-GPS-0006-01' OR (target.section_id = 'A' AND target.grave_id = '0006A'))
  ),
  'new gravesite TLC-GPS-0006-01 / A-0006A must be unused'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0006' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM gravesites g JOIN headstones h ON h.gravesite_uuid = g.id
    WHERE g.gravesite_id = 'TLC-GPS-0006' AND g.section_id = 'A' AND g.deleted_at IS NULL
      AND h.headstone_id = 'TLC-HS-0006' AND h.deleted_at IS NULL
      AND (SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
        WHERE hb.headstone_uuid = h.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
          AND b.gravesite_uuid = g.id AND b.full_name IN ('Herb Scott', 'Patricia Scott')) = 2
  ),
  'both Scott burials and the marker must belong to active Section A gravesite TLC-GPS-0006'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0006' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM burials b JOIN headstone_burials hb ON hb.burial_uuid = b.id
    JOIN headstones h ON h.id = hb.headstone_uuid
    JOIN burial_record_status_types s ON s.id = b.burial_record_status_type_id
    WHERE h.headstone_id = 'TLC-HS-0006' AND h.deleted_at IS NULL
      AND hb.deleted_at IS NULL AND b.deleted_at IS NULL AND b.full_name = 'Patricia Scott'
      AND s.code = 'pre_need_inscription' AND b.death_date IS NULL AND b.burial_date IS NULL
      AND NULLIF(trim(b.death_date_text), '') IS NULL
  ),
  'Patricia Scott must retain pre-need status without recorded death or burial dates'
);

WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0006' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0006'
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
herb_gravesite AS (
  UPDATE gravesites
  SET name = 'Herb Scott', geometry = replacement_geometries.south_geometry,
    width_feet = 4.00, length_feet = 10.00, geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0006 using fixed marker TLC-HS-0006 as the boundary between A-0006 and A-0006A.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Herb Scott retained in original gravesite A-0006 and moved south; Patricia Scott was assigned the new grave north of the fixed shared marker on 2026-09-14. Estimated overlaps with A-0054/A-0055 require field review; see ADR 0054.'
    ), updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
patricia_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, block_uuid, lot_uuid, 'Patricia Scott', facility_id,
    section_id, block_id, lot_id, '0006A', 'TLC-GPS-0006-01', cost, north_geometry,
    4.00, 10.00, (SELECT id FROM gravesite_status_types WHERE code = 'reserved'), 'operational',
    'Split from TLC-GPS-0006 using fixed marker TLC-HS-0006 as the boundary between A-0006 and A-0006A.',
    'estimated', 'Patricia Scott assigned to reserved gravesite A-0006A immediately north of A-0006 on 2026-09-14. Pre-need inscription preserved; no death or interment is asserted. Estimated overlaps with A-0054/A-0055 require field review; see ADR 0054.', now()
  FROM herb_gravesite
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
  SELECT herb_gravesite.id AS herb_gravesite_uuid,
    patricia_gravesite.id AS patricia_gravesite_uuid, herb_gravesite.headstone_uuid
  FROM herb_gravesite CROSS JOIN patricia_gravesite
),
updated_herb_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.herb_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0006', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'herb scott'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
updated_patricia_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.patricia_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0006-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'patricia scott'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, herb_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, patricia_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_herb_burial.id
  FROM marker_context CROSS JOIN updated_herb_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_patricia_burial.id
  FROM marker_context CROSS JOIN updated_patricia_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.herb_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
