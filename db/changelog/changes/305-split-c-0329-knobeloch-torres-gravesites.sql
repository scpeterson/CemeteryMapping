--liquibase formatted sql

--changeset cemeterymapping:305-split-c-0329-knobeloch-torres-gravesites splitStatements:false
WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0329' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0329'
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
judith_gravesite AS (
  UPDATE gravesites
  SET name = 'Judith A Knobeloch', geometry = replacement_geometries.south_geometry,
    width_feet = 4.00, length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0329 using fixed marker TLC-HS-0329 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Judith A Knobeloch retained in original gravesite C-0329 and moved south when splitting the shared marker on 2026-08-10.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
kimberly_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, block_uuid, lot_uuid, 'Kimberly A Torres', facility_id,
    section_id, block_id, lot_id, '0329A', 'TLC-GPS-0329-01', cost, north_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0329 using fixed marker TLC-HS-0329 as shared north/south boundary.',
    'estimated',
    'Kimberly A Torres assigned to the new northern gravesite C-0329A on 2026-08-10; burial postdates the NHG and imported gravesite spreadsheet.',
    now()
  FROM judith_gravesite
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
  SELECT judith_gravesite.id AS judith_gravesite_uuid,
    kimberly_gravesite.id AS kimberly_gravesite_uuid, judith_gravesite.headstone_uuid
  FROM judith_gravesite CROSS JOIN kimberly_gravesite
),
updated_judith_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.judith_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0329', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'judith a knobeloch'
  RETURNING burials.*
),
updated_kimberly_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.kimberly_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0329-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'kimberly a torres'
  RETURNING burials.id
),
inserted_kimberly_burial AS (
  INSERT INTO burials (
    gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date,
    funeral_home, veteran, notes, gravesite_id, military_branch_type_id, military_war_service_type_id,
    interment_type_id, birth_date_text, death_date_text, maiden_name, military_rank_type_id,
    burial_record_status_type_id, data_confidence, review_status, review_notes, source_conflict,
    source_properties, reviewed_by, reviewed_at, death_place_uuid, updated_at
  )
  SELECT marker_context.kimberly_gravesite_uuid, 'Kimberly A', 'Torres', 'Kimberly A Torres',
    updated_judith_burial.sex, NULL, NULL, NULL, NULL, NULL, false,
    'Created from field evidence on 2026-08-10; this burial postdates the NHG and imported gravesite spreadsheet.',
    'TLC-GPS-0329-01', NULL, NULL, updated_judith_burial.interment_type_id,
    NULL, NULL, NULL, NULL, updated_judith_burial.burial_record_status_type_id,
    'medium', 'needs_review', NULL, false,
    jsonb_build_object('source', 'field evidence', 'nhg_inclusion', 'not listed',
      'imported_gravesite_spreadsheet_inclusion', 'not listed', 'recorded_on', '2026-08-10'),
    NULL, NULL, NULL, now()
  FROM marker_context CROSS JOIN updated_judith_burial
  WHERE NOT EXISTS (SELECT 1 FROM updated_kimberly_burial)
  RETURNING id
),
kimberly_burial AS (
  SELECT id FROM updated_kimberly_burial
  UNION ALL
  SELECT id FROM inserted_kimberly_burial
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, judith_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL SELECT headstone_uuid, kimberly_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_judith_burial.id
  FROM marker_context CROSS JOIN updated_judith_burial
  UNION ALL SELECT marker_context.headstone_uuid, kimberly_burial.id
  FROM marker_context CROSS JOIN kimberly_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.judith_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
