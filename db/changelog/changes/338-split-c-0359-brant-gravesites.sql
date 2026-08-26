--liquibase formatted sql

--changeset cemeterymapping:338-split-c-0359-brant-gravesites splitStatements:false
--validCheckSum 9:612fb0ed5c506c3e4a27c0c06e9a50b2
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id IN ('TLC-GPS-0358', 'TLC-GPS-0360') AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0359'
      AND upper(COALESCE(section_id, '')) = 'C'
      AND deleted_at IS NULL
  ),
  'active Section C gravesite TLC-GPS-0359 must exist when its neighboring operational gravesites exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0359' AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM headstones
    WHERE headstone_id = 'TLC-HS-0359' AND geometry IS NOT NULL AND deleted_at IS NULL
  ),
  'active marker TLC-HS-0359 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0359' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'eleanor brant' AND deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'elmer h brant' AND deleted_at IS NULL
  ) = 1,
  'exactly one active Eleanor Brant burial and one active Elmer H Brant burial must exist'
);

WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0359'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0359'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
projected_corners AS (
  SELECT
    source_record.*,
    headstone_point AS shared_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry AS elmer_north_west_corner,
    ST_Project(headstone_point::geography, 8 * 0.3048, 0)::geometry AS bette_north_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS eleanor_south_west_corner
  FROM source_record
),
replacement_geometries AS (
  SELECT
    projected_corners.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      eleanor_south_west_corner,
      ST_Project(eleanor_south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      shared_west_corner,
      eleanor_south_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS eleanor_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      shared_west_corner,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(elmer_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      elmer_north_west_corner,
      shared_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS elmer_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      elmer_north_west_corner,
      ST_Project(elmer_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(bette_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      bette_north_west_corner,
      elmer_north_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS bette_geometry
  FROM projected_corners
),
eleanor_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Eleanor Brant',
    geometry = replacement_geometries.eleanor_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0359 using fixed marker TLC-HS-0359 as the Eleanor/Elmer boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Eleanor Brant retained in original gravesite C-0359 and moved south; Elmer H Brant and Bette C Brandt were placed in consecutive graves north of the fixed marker on 2026-08-26.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid,
    replacement_geometries.elmer_geometry, replacement_geometries.bette_geometry
),
elmer_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Elmer H Brant', facility_id,
    section_id, block_id, lot_id, '0359A', 'TLC-GPS-0359-01', cost, elmer_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0359 using fixed marker TLC-HS-0359 as the Eleanor/Elmer boundary.',
    'estimated',
    'Elmer H Brant assigned to new gravesite C-0359A immediately north of the fixed shared marker on 2026-08-26.',
    now()
  FROM eleanor_gravesite
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
bette_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Bette C Brandt', facility_id,
    section_id, block_id, lot_id, '0359B', 'TLC-GPS-0359-02', cost, bette_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0359 using fixed marker TLC-HS-0359 as the Eleanor/Elmer boundary.',
    'estimated',
    'Bette C Brandt assigned to new gravesite C-0359B north of C-0359A on 2026-08-26.',
    now()
  FROM eleanor_gravesite
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
    eleanor_gravesite.id AS eleanor_gravesite_uuid,
    elmer_gravesite.id AS elmer_gravesite_uuid,
    bette_gravesite.id AS bette_gravesite_uuid,
    eleanor_gravesite.headstone_uuid
  FROM eleanor_gravesite CROSS JOIN elmer_gravesite CROSS JOIN bette_gravesite
),
updated_eleanor_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.eleanor_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0359', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'eleanor brant'
  RETURNING burials.*
),
updated_elmer_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.elmer_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0359-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'elmer h brant'
  RETURNING burials.*
),
inserted_bette_burial AS (
  INSERT INTO burials (
    gravesite_uuid, first_name, last_name, full_name, sex, gravesite_id,
    interment_type_id, burial_record_status_type_id, data_confidence, review_status,
    review_notes, source_conflict, updated_at
  )
  SELECT
    marker_context.bette_gravesite_uuid, 'Bette C', 'Brandt', 'Bette C Brandt', 'female',
    'TLC-GPS-0359-02', updated_eleanor_burial.interment_type_id,
    updated_eleanor_burial.burial_record_status_type_id, 'high', 'reviewed',
    'Added from field-confirmed shared headstone TLC-HS-0359 information on 2026-08-26.',
    false, now()
  FROM marker_context CROSS JOIN updated_eleanor_burial
  WHERE NOT EXISTS (
    SELECT 1 FROM burials existing
    WHERE lower(COALESCE(existing.full_name, '')) = 'bette c brandt'
      AND existing.deleted_at IS NULL
  )
  RETURNING *
),
bette_burial AS (
  SELECT id FROM inserted_bette_burial
  UNION ALL
  SELECT existing.id
  FROM burials existing CROSS JOIN marker_context
  WHERE lower(COALESCE(existing.full_name, '')) = 'bette c brandt'
    AND existing.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM inserted_bette_burial)
),
updated_existing_bette_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.bette_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0359-02', updated_at = now()
  FROM marker_context
  WHERE burials.id IN (SELECT id FROM bette_burial)
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, eleanor_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, elmer_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, bette_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_eleanor_burial.id
  FROM marker_context CROSS JOIN updated_eleanor_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_elmer_burial.id
  FROM marker_context CROSS JOIN updated_elmer_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_existing_bette_burial.id
  FROM marker_context CROSS JOIN updated_existing_bette_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.eleanor_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
