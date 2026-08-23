--liquibase formatted sql

--changeset cemeterymapping:321-split-c-0338-hague-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  EXISTS (
    SELECT 1
    FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0338'
      AND upper(COALESCE(section_id, '')) = 'C'
      AND deleted_at IS NULL
  ),
  'active Section C gravesite TLC-GPS-0338 must exist'
);

SELECT assert_migration_prerequisite(
  EXISTS (
    SELECT 1
    FROM headstones
    WHERE headstone_id = 'TLC-HS-0338'
      AND geometry IS NOT NULL
      AND deleted_at IS NULL
  ),
  'active marker TLC-HS-0338 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  (
    SELECT count(*)
    FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'arthur julius hague'
      AND deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*)
    FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'isabelle m hague'
      AND deleted_at IS NULL
  ) = 1,
  'exactly one active Arthur Julius Hague burial and one active Isabelle M Hague burial must exist'
);

WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0338'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0338'
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
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            shared_west_corner,
            ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            north_west_corner,
            shared_west_corner
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            south_west_corner,
            ST_Project(south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            shared_west_corner,
            south_west_corner
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS south_geometry
  FROM projected_corners
),
arthur_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Arthur Julius Hague',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0338 using fixed marker TLC-HS-0338 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Arthur Julius Hague retained in original gravesite C-0338 and moved south when splitting the shared Hague marker on 2026-08-23.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING
    gravesites.*,
    replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry
),
isabelle_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    name,
    facility_id,
    section_id,
    block_id,
    lot_id,
    grave_id,
    gravesite_id,
    cost,
    geometry,
    width_feet,
    length_feet,
    status_type_id,
    geometry_type,
    geometry_source,
    geometry_confidence,
    geometry_notes,
    updated_at
  )
  SELECT
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    'Isabelle M Hague',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0338A',
    'TLC-GPS-0338-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Split from TLC-GPS-0338 using fixed marker TLC-HS-0338 as shared north/south boundary.',
    'estimated',
    'Isabelle M Hague assigned to the new northern gravesite C-0338A when splitting the shared Hague marker on 2026-08-23.',
    now()
  FROM arthur_gravesite
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    section_uuid = EXCLUDED.section_uuid,
    block_uuid = EXCLUDED.block_uuid,
    lot_uuid = EXCLUDED.lot_uuid,
    name = EXCLUDED.name,
    facility_id = EXCLUDED.facility_id,
    section_id = EXCLUDED.section_id,
    block_id = EXCLUDED.block_id,
    lot_id = EXCLUDED.lot_id,
    grave_id = EXCLUDED.grave_id,
    cost = EXCLUDED.cost,
    geometry = EXCLUDED.geometry,
    width_feet = EXCLUDED.width_feet,
    length_feet = EXCLUDED.length_feet,
    status_type_id = EXCLUDED.status_type_id,
    geometry_type = EXCLUDED.geometry_type,
    geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence,
    geometry_notes = EXCLUDED.geometry_notes,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING *
),
marker_context AS (
  SELECT
    arthur_gravesite.id AS arthur_gravesite_uuid,
    isabelle_gravesite.id AS isabelle_gravesite_uuid,
    arthur_gravesite.headstone_uuid
  FROM arthur_gravesite
  CROSS JOIN isabelle_gravesite
),
updated_arthur_burial AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.arthur_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0338',
    updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'arthur julius hague'
    AND EXISTS (
      SELECT 1
      FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id
        AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
updated_isabelle_burial AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.isabelle_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0338-01',
    updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'isabelle m hague'
    AND EXISTS (
      SELECT 1
      FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id
        AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    updated_at
  )
  SELECT headstone_uuid, arthur_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, isabelle_gravesite_uuid, 'spans', now()
  FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans',
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_arthur_burial.id
  FROM marker_context
  CROSS JOIN updated_arthur_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_isabelle_burial.id
  FROM marker_context
  CROSS JOIN updated_isabelle_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.arthur_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
