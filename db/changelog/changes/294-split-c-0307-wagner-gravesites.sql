--liquibase formatted sql

--changeset cemeterymapping:294-split-c-0307-wagner-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0307'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0307'
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
anthony_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Anthony Wagner',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0307 using fixed marker TLC-HS-0307 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Anthony Wagner retained in original gravesite C-0307 and moved south when splitting the shared Wagner marker on 2026-08-08.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
helen_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Helen Wagner', facility_id, section_id, block_id, lot_id,
    '0307A', 'TLC-GPS-0307-01', cost, north_geometry, 4.00, 10.00, status_type_id,
    'operational',
    'Split from TLC-GPS-0307 using fixed marker TLC-HS-0307 as shared north/south boundary.',
    'estimated',
    'Helen Wagner assigned to new northern gravesite C-0307A when splitting the shared Wagner marker on 2026-08-08.',
    now()
  FROM anthony_gravesite
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
    anthony_gravesite.id AS anthony_gravesite_uuid,
    helen_gravesite.id AS helen_gravesite_uuid,
    anthony_gravesite.headstone_uuid
  FROM anthony_gravesite
  CROSS JOIN helen_gravesite
),
wagner_burials AS (
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
    AND lower(COALESCE(burials.last_name, '')) = 'wagner'
    AND lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) IN ('anthony', 'helen')
),
updated_anthony_burials AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.anthony_gravesite_uuid, gravesite_id = 'TLC-GPS-0307', updated_at = now()
  FROM marker_context, wagner_burials
  WHERE burials.id = wagner_burials.id
    AND wagner_burials.normalized_given_name = 'anthony'
  RETURNING burials.id
),
updated_helen_burials AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.helen_gravesite_uuid, gravesite_id = 'TLC-GPS-0307-01', updated_at = now()
  FROM marker_context, wagner_burials
  WHERE burials.id = wagner_burials.id
    AND wagner_burials.normalized_given_name = 'helen'
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, anthony_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, helen_gravesite_uuid, 'spans', now() FROM marker_context
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
  SELECT marker_context.headstone_uuid, updated_anthony_burials.id
  FROM marker_context CROSS JOIN updated_anthony_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_helen_burials.id
  FROM marker_context CROSS JOIN updated_helen_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.anthony_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
