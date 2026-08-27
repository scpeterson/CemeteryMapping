--liquibase formatted sql

--changeset cemeterymapping:341-split-c-0367-kohler-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id IN ('TLC-GPS-0366', 'TLC-GPS-0368') AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0367'
      AND upper(COALESCE(section_id, '')) = 'C'
      AND deleted_at IS NULL
  ),
  'active Section C gravesite TLC-GPS-0367 must exist when its neighboring operational gravesites exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0367' AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM headstones
    WHERE headstone_id = 'TLC-HS-0367' AND geometry IS NOT NULL AND deleted_at IS NULL
  ),
  'active marker TLC-HS-0367 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0367' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'edmund kohler' AND deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'marie kohler' AND deleted_at IS NULL
  ) = 1,
  'exactly one active Edmund Kohler burial and one active Marie Kohler burial must exist'
);

WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point,
    ST_SetSRID(
      ST_MakePoint(
        ST_XMin(ST_Envelope(gravesites.geometry)),
        ST_YMax(ST_Envelope(gravesites.geometry))
      ),
      4326
    ) AS existing_north_west_corner
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0367'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0367'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
replacement_geometries AS (
  SELECT
    source_record.*,
    ST_Project(existing_north_west_corner::geography, 4 * 0.3048, 0)::geometry AS marie_north_west_corner,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      existing_north_west_corner,
      ST_Project(existing_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(
        ST_Project(existing_north_west_corner::geography, 4 * 0.3048, 0),
        10 * 0.3048,
        pi() / 2
      )::geometry,
      ST_Project(existing_north_west_corner::geography, 4 * 0.3048, 0)::geometry,
      existing_north_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS marie_geometry
  FROM source_record
),
edmund_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Edmund Kohler',
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Edmund Kohler retained in the original C-0367 geometry; Marie Kohler was placed in a new grave immediately north on 2026-08-26 to avoid overlap with C-0366.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.headstone_point,
    replacement_geometries.marie_geometry
),
marie_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Marie Kohler', facility_id,
    section_id, block_id, lot_id, '0367A', 'TLC-GPS-0367-01', cost, marie_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Created immediately north of existing TLC-GPS-0367 while retaining fixed marker TLC-HS-0367.',
    'estimated',
    'Marie Kohler assigned to new northern gravesite C-0367A when splitting the shared Kohler marker on 2026-08-26.',
    now()
  FROM edmund_gravesite
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
    edmund_gravesite.id AS edmund_gravesite_uuid,
    marie_gravesite.id AS marie_gravesite_uuid,
    edmund_gravesite.headstone_uuid
  FROM edmund_gravesite CROSS JOIN marie_gravesite
),
updated_edmund_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.edmund_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0367', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'edmund kohler'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id
        AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
updated_marie_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.marie_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0367-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'marie kohler'
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
  SELECT headstone_uuid, edmund_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, marie_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_edmund_burial.id
  FROM marker_context CROSS JOIN updated_edmund_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_marie_burial.id
  FROM marker_context CROSS JOIN updated_marie_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.edmund_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
