--liquibase formatted sql

--changeset cemeterymapping:300-split-c-0317-brant-gravesites splitStatements:false
WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point,
    (SELECT ST_YMin(Box2D(north_neighbor.geometry))
     FROM gravesites north_neighbor
     WHERE north_neighbor.gravesite_id = 'TLC-GPS-0318'
       AND north_neighbor.deleted_at IS NULL) AS north_latitude
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0317' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0317'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
projected_corners AS (
  SELECT source_record.*, headstone_point AS shared_west_corner,
    ST_SetSRID(ST_MakePoint(ST_X(headstone_point), north_latitude), 4326) AS north_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS south_west_corner
  FROM source_record
  WHERE north_latitude > ST_Y(headstone_point)
),
replacement_geometries AS (
  SELECT projected_corners.*,
    ST_Distance(shared_west_corner::geography, north_west_corner::geography) / 0.3048 AS north_width_feet,
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
george_gravesite AS (
  UPDATE gravesites
  SET name = 'George W Brant',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0317 using fixed marker TLC-HS-0317 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'George W Brant retained in original gravesite C-0317 and moved south when splitting the shared Brant marker on 2026-08-09.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry, replacement_geometries.north_width_feet
),
anna_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, block_uuid, lot_uuid, 'Anna C Brant', facility_id,
    section_id, block_id, lot_id, '0317A', 'TLC-GPS-0317-01', cost, north_geometry,
    round(north_width_feet::numeric, 2), 10.00, status_type_id, 'operational',
    'Fit north of fixed marker TLC-HS-0317 and south of TLC-GPS-0318.',
    'estimated',
    'Anna C Brant assigned to the new northern gravesite C-0317A when splitting the shared Brant marker on 2026-08-09.',
    now()
  FROM george_gravesite
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
  SELECT george_gravesite.id AS george_gravesite_uuid,
    anna_gravesite.id AS anna_gravesite_uuid, george_gravesite.headstone_uuid
  FROM george_gravesite CROSS JOIN anna_gravesite
),
updated_george_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.george_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0317', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'george w brant'
  RETURNING burials.id
),
updated_anna_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.anna_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0317-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'anna c brant'
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, george_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL SELECT headstone_uuid, anna_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_george_burial.id
  FROM marker_context CROSS JOIN updated_george_burial
  UNION ALL SELECT marker_context.headstone_uuid, updated_anna_burial.id
  FROM marker_context CROSS JOIN updated_anna_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.george_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
