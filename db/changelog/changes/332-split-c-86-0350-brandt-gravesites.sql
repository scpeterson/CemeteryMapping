--liquibase formatted sql

--changeset cemeterymapping:332-split-c-86-0350-brandt-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id IN ('TLC-GPS-0349', 'TLC-GPS-0351') AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0350'
      AND upper(COALESCE(section_id, '')) = 'C'
      AND lot_id = '86'
      AND deleted_at IS NULL
  ),
  'active Section C lot 86 gravesite TLC-GPS-0350 must exist when its neighboring operational gravesites exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0350' AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM headstones
    WHERE headstone_id = 'TLC-HS-0350' AND geometry IS NOT NULL AND deleted_at IS NULL
  ),
  'active marker TLC-HS-0350 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0350' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'herman p brandt' AND deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'allie h, ruth anna brandt' AND deleted_at IS NULL
  ) = 1,
  'exactly one active Herman P Brandt burial and one active combined Allie H, Ruth Anna Brandt burial must exist'
);

WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0350'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0350'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
    AND gravesites.lot_id = '86'
  LIMIT 1
),
projected_corners AS (
  SELECT
    source_record.*,
    headstone_point AS shared_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry AS allie_north_west_corner,
    ST_Project(headstone_point::geography, 8 * 0.3048, 0)::geometry AS ruth_north_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS herman_south_west_corner
  FROM source_record
),
replacement_geometries AS (
  SELECT
    projected_corners.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      herman_south_west_corner,
      ST_Project(herman_south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      shared_west_corner,
      herman_south_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS herman_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      shared_west_corner,
      ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(allie_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      allie_north_west_corner,
      shared_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS allie_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      allie_north_west_corner,
      ST_Project(allie_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(ruth_north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ruth_north_west_corner,
      allie_north_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS ruth_geometry
  FROM projected_corners
),
herman_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Herman P Brant',
    geometry = replacement_geometries.herman_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0350 using fixed marker TLC-HS-0350 as the Herman/Allie boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'Herman P Brant retained in original gravesite C-86-0350 and moved south; Allie and Ruth were placed in consecutive graves north of the fixed marker on 2026-08-24.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid,
    replacement_geometries.allie_geometry, replacement_geometries.ruth_geometry
),
allie_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Allie H Brandt', facility_id,
    section_id, block_id, lot_id, '0350A', 'TLC-GPS-0350-01', cost, allie_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0350 using fixed marker TLC-HS-0350 as the Herman/Allie boundary.',
    'estimated',
    'Allie H Brandt assigned to new gravesite C-86-0350A immediately north of the fixed shared marker on 2026-08-24.',
    now()
  FROM herman_gravesite
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
ruth_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'Ruth Anna Brandt', facility_id,
    section_id, block_id, lot_id, '0350B', 'TLC-GPS-0350-02', cost, ruth_geometry,
    4.00, 10.00, status_type_id, 'operational',
    'Split from TLC-GPS-0350 using fixed marker TLC-HS-0350 as the Herman/Allie boundary.',
    'estimated',
    'Ruth Anna Brandt assigned to new gravesite C-86-0350B north of C-86-0350A on 2026-08-24.',
    now()
  FROM herman_gravesite
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
    herman_gravesite.id AS herman_gravesite_uuid,
    allie_gravesite.id AS allie_gravesite_uuid,
    ruth_gravesite.id AS ruth_gravesite_uuid,
    herman_gravesite.headstone_uuid
  FROM herman_gravesite CROSS JOIN allie_gravesite CROSS JOIN ruth_gravesite
),
updated_herman_burial AS (
  UPDATE burials
  SET first_name = 'Herman P', last_name = 'Brant', full_name = 'Herman P Brant',
      gravesite_uuid = marker_context.herman_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0350', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'herman p brandt'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id
        AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
updated_allie_burial AS (
  UPDATE burials
  SET first_name = 'Allie H', last_name = 'Brandt', full_name = 'Allie H Brandt',
      gravesite_uuid = marker_context.allie_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0350-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'allie h, ruth anna brandt'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id
        AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.*
),
updated_ruth_burial AS (
  INSERT INTO burials (
    gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date,
    funeral_home, veteran, notes, gravesite_id, military_branch_type_id, military_war_service_type_id,
    interment_type_id, birth_date_text, death_date_text, maiden_name, military_rank_type_id,
    burial_record_status_type_id,
    data_confidence, review_status, review_notes, source_conflict, reviewed_by, reviewed_at, death_place_uuid,
    updated_at
  )
  SELECT
    marker_context.ruth_gravesite_uuid, 'Ruth Anna', 'Brandt', 'Ruth Anna Brandt', updated_allie_burial.sex,
    DATE '1910-01-01', DATE '1913-01-01', NULL, updated_allie_burial.burial_date,
    updated_allie_burial.funeral_home, updated_allie_burial.veteran,
    concat_ws(' ', NULLIF(updated_allie_burial.notes, ''),
      'Combined Allie H and Ruth Anna record split into distinct burials from TLC-HS-0350 on 2026-08-24.'),
    'TLC-GPS-0350-02', updated_allie_burial.military_branch_type_id,
    updated_allie_burial.military_war_service_type_id, updated_allie_burial.interment_type_id,
    '1910', '1913', NULL, updated_allie_burial.military_rank_type_id,
    updated_allie_burial.burial_record_status_type_id,
    updated_allie_burial.data_confidence, updated_allie_burial.review_status,
    updated_allie_burial.review_notes, updated_allie_burial.source_conflict,
    updated_allie_burial.reviewed_by, updated_allie_burial.reviewed_at, NULL, now()
  FROM updated_allie_burial CROSS JOIN marker_context
  WHERE NOT EXISTS (
    SELECT 1 FROM burials existing
    WHERE lower(COALESCE(existing.full_name, '')) = 'ruth anna brandt'
      AND existing.deleted_at IS NULL
      AND existing.gravesite_id = 'TLC-GPS-0350-02'
  )
  RETURNING id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, herman_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, allie_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, ruth_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_herman_burial.id
  FROM marker_context CROSS JOIN updated_herman_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_allie_burial.id
  FROM marker_context CROSS JOIN updated_allie_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_ruth_burial.id
  FROM marker_context CROSS JOIN updated_ruth_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.herman_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
