--liquibase formatted sql

--changeset cemeterymapping:273-split-c-0306-schmidt-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0306'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0306'
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
elmer_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Elmer G Schmidt',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0306 using fixed marker TLC-HS-0306 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Elmer G Schmidt retained in original gravesite C-0306 and moved south when splitting the shared Schmidt marker on 2026-08-02.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
magdeline_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Magdeline P Schmidt', facility_id, section_id, block_id, lot_id,
    '0306A', 'TLC-GPS-0306-01', cost, north_geometry, 4.00, 10.00, status_type_id,
    'operational',
    'Split from TLC-GPS-0306 using fixed marker TLC-HS-0306 as shared north/south boundary.',
    'estimated',
    'Magdeline P Schmidt assigned to new northern gravesite C-0306A when splitting the shared Schmidt marker on 2026-08-02.',
    now()
  FROM elmer_gravesite
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
    elmer_gravesite.id AS elmer_gravesite_uuid,
    magdeline_gravesite.id AS magdeline_gravesite_uuid,
    elmer_gravesite.headstone_uuid
  FROM elmer_gravesite
  CROSS JOIN magdeline_gravesite
),
schmidt_burials AS (
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
    AND lower(COALESCE(burials.last_name, '')) = 'schmidt'
    AND lower(split_part(trim(COALESCE(burials.first_name, '')), ' ', 1)) IN ('elmer', 'magdeline')
),
updated_elmer_burials AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.elmer_gravesite_uuid, gravesite_id = 'TLC-GPS-0306', updated_at = now()
  FROM marker_context, schmidt_burials
  WHERE burials.id = schmidt_burials.id
    AND schmidt_burials.normalized_given_name = 'elmer'
  RETURNING burials.id
),
updated_magdeline_burials AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.magdeline_gravesite_uuid, gravesite_id = 'TLC-GPS-0306-01', updated_at = now()
  FROM marker_context, schmidt_burials
  WHERE burials.id = schmidt_burials.id
    AND schmidt_burials.normalized_given_name = 'magdeline'
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, elmer_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, magdeline_gravesite_uuid, 'spans', now() FROM marker_context
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
  SELECT marker_context.headstone_uuid, updated_elmer_burials.id
  FROM marker_context CROSS JOIN updated_elmer_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_magdeline_burials.id
  FROM marker_context CROSS JOIN updated_magdeline_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.elmer_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
