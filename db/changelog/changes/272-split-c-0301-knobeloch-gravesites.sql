--liquibase formatted sql

--changeset cemeterymapping:272-split-c-0301-knobeloch-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0301'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0301'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
replacement_geometries AS (
  SELECT
    source_record.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      headstone_point,
      ST_Project(headstone_point::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(ST_Project(headstone_point::geography, 4 * 0.3048, 0), 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry,
      headstone_point
    ])), 4326))::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry,
      ST_Project(ST_Project(headstone_point::geography, 4 * 0.3048, pi()), 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(headstone_point::geography, 10 * 0.3048, pi() / 2)::geometry,
      headstone_point,
      ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry
    ])), 4326))::geometry(MultiPolygon, 4326) AS south_geometry
  FROM source_record
),
christy_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Christy Knobeloch',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0301 using fixed marker TLC-HS-0301 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Christy Knobeloch retained in original gravesite C-0301 and moved south when splitting the shared Knobeloch marker on 2026-08-01.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
grace_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Grace Dexter Knobeloch', facility_id, section_id, block_id, lot_id,
    '0301A', 'TLC-GPS-0301-01', cost, north_geometry, 4.00, 10.00, status_type_id,
    'operational',
    'Split from TLC-GPS-0301 using fixed marker TLC-HS-0301 as shared north/south boundary.',
    'estimated',
    'Grace Dexter Knobeloch assigned to new northern gravesite C-0301A when splitting the shared Knobeloch marker on 2026-08-01.',
    now()
  FROM christy_gravesite
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
    christy_gravesite.id AS christy_gravesite_uuid,
    grace_gravesite.id AS grace_gravesite_uuid,
    christy_gravesite.headstone_uuid
  FROM christy_gravesite
  CROSS JOIN grace_gravesite
),
knobeloch_burials AS (
  SELECT
    burials.id,
    lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) AS normalized_given_name
  FROM burials
  JOIN headstone_burials
    ON headstone_burials.burial_uuid = burials.id
   AND headstone_burials.deleted_at IS NULL
  JOIN marker_context
    ON marker_context.headstone_uuid = headstone_burials.headstone_uuid
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.last_name, '')) = 'knobeloch'
    AND lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) IN ('christy', 'grace')
),
updated_christy_burials AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.christy_gravesite_uuid, gravesite_id = 'TLC-GPS-0301', updated_at = now()
  FROM marker_context, knobeloch_burials
  WHERE burials.id = knobeloch_burials.id
    AND knobeloch_burials.normalized_given_name = 'christy'
  RETURNING burials.id
),
updated_grace_burials AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.grace_gravesite_uuid, gravesite_id = 'TLC-GPS-0301-01', updated_at = now()
  FROM marker_context, knobeloch_burials
  WHERE burials.id = knobeloch_burials.id
    AND knobeloch_burials.normalized_given_name = 'grace'
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, christy_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, grace_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans',
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_christy_burials.id
  FROM marker_context CROSS JOIN updated_christy_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_grace_burials.id
  FROM marker_context CROSS JOIN updated_grace_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.christy_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
