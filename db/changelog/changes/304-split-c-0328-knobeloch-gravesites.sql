--liquibase formatted sql

--changeset cemeterymapping:304-split-c-0328-knobeloch-gravesites splitStatements:false
WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0328' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0328'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
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
howard_gravesite AS (
  UPDATE gravesites
  SET name = 'Howard W Knobeloch', geometry = replacement_geometries.south_geometry,
    width_feet = 4.00, length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0328 using fixed marker TLC-HS-0328 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Howard W Knobeloch retained in original gravesite C-0328 and moved south when splitting the shared Knobeloch marker on 2026-08-10.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
june_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, block_uuid, lot_uuid, 'June O Knobeloch', facility_id,
    section_id, block_id, lot_id, '0328A', 'TLC-GPS-0328-01', cost, north_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0328 using fixed marker TLC-HS-0328 as shared north/south boundary.',
    'estimated',
    'June O Knobeloch assigned to the new northern gravesite C-0328A when splitting the shared Knobeloch marker on 2026-08-10.',
    now()
  FROM howard_gravesite
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
  SELECT howard_gravesite.id AS howard_gravesite_uuid,
    june_gravesite.id AS june_gravesite_uuid, howard_gravesite.headstone_uuid
  FROM howard_gravesite CROSS JOIN june_gravesite
),
updated_howard_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.howard_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0328', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'howard w knobeloch'
  RETURNING burials.id
),
updated_june_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.june_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0328-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'june o knobeloch'
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, howard_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL SELECT headstone_uuid, june_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_howard_burial.id
  FROM marker_context CROSS JOIN updated_howard_burial
  UNION ALL SELECT marker_context.headstone_uuid, updated_june_burial.id
  FROM marker_context CROSS JOIN updated_june_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.howard_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
