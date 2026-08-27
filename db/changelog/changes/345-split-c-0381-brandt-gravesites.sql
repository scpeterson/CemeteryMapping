--liquibase formatted sql

--changeset cemeterymapping:345-split-c-0381-brandt-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id IN ('TLC-GPS-0380', 'TLC-GPS-0382') AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0381'
      AND upper(COALESCE(section_id, '')) = 'C'
      AND deleted_at IS NULL
  ),
  'active Section C gravesite TLC-GPS-0381 must exist when its neighboring operational gravesites exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0381' AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM headstones
    WHERE headstone_id = 'TLC-HS-0381' AND geometry IS NOT NULL AND deleted_at IS NULL
  ),
  'active marker TLC-HS-0381 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0381' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'h carl brandt' AND deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'alice r brandt' AND deleted_at IS NULL
  ) = 1,
  'exactly one active H Carl Brandt burial and one active Alice R Brandt burial must exist'
);

WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0381'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0381'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
projected_corners AS (
  SELECT
    source_record.*,
    headstone_point AS shared_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry AS north_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS south_west_corner
  FROM source_record
),
replacement_geometries AS (
  SELECT
    projected_corners.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      shared_west_corner,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_west_corner,
      shared_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_west_corner,
      ST_Project(south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      shared_west_corner,
      south_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS south_geometry
  FROM projected_corners
),
carl_gravesite AS (
  UPDATE gravesites
  SET
    name = 'H Carl Brandt',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0381 using fixed marker TLC-HS-0381 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'H Carl Brandt retained in original gravesite C-0381 and moved south when splitting the shared Brandt marker on 2026-08-27.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
alice_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Alice R Brandt', facility_id,
    section_id, block_id, lot_id, '0381A', 'TLC-GPS-0381-01', cost, north_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0381 using fixed marker TLC-HS-0381 as shared north/south boundary.',
    'estimated',
    'Alice R Brandt assigned to new northern gravesite C-0381A when splitting the shared Brandt marker on 2026-08-27.',
    now()
  FROM carl_gravesite
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
  SELECT
    carl_gravesite.id AS carl_gravesite_uuid,
    alice_gravesite.id AS alice_gravesite_uuid,
    carl_gravesite.headstone_uuid
  FROM carl_gravesite CROSS JOIN alice_gravesite
),
updated_carl_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.carl_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0381', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'h carl brandt'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id
        AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
updated_alice_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.alice_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0381-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'alice r brandt'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id
        AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, carl_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, alice_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_carl_burial.id
  FROM marker_context CROSS JOIN updated_carl_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_alice_burial.id
  FROM marker_context CROSS JOIN updated_alice_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.carl_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty

