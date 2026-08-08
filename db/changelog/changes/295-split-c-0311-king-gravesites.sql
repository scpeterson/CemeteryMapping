--liquibase formatted sql

--changeset cemeterymapping:295-split-c-0311-king-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_XMin(Box2D(gravesites.geometry)) AS west_longitude,
    LEAST(
      ST_XMax(Box2D(gravesites.geometry)),
      COALESCE((
        SELECT ST_XMin(Box2D(east_neighbor.geometry))
        FROM gravesites east_neighbor
        WHERE east_neighbor.gravesite_id = 'TLC-GPS-0295'
          AND east_neighbor.deleted_at IS NULL
      ), ST_XMax(Box2D(gravesites.geometry)))
    ) AS east_longitude,
    ST_YMax(Box2D(gravesites.geometry)) AS south_latitude,
    (
      SELECT ST_YMin(Box2D(north_neighbor.geometry))
      FROM gravesites north_neighbor
      WHERE north_neighbor.gravesite_id = 'TLC-GPS-0312'
        AND north_neighbor.deleted_at IS NULL
    ) AS north_latitude
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0311'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0311'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
target_gravesites(name, grave_id, gravesite_id, sort_order) AS (
  VALUES
    ('Elizabeth King', '0311A', 'TLC-GPS-0311-01', 0),
    ('Lorena King', '0311B', 'TLC-GPS-0311-02', 1),
    ('Coretta King', '0311C', 'TLC-GPS-0311-03', 2),
    ('Anna King', '0311D', 'TLC-GPS-0311-04', 3)
),
replacement_gravesites AS (
  SELECT
    source_record.*,
    target_gravesites.name AS replacement_name,
    target_gravesites.grave_id AS replacement_grave_id,
    target_gravesites.gravesite_id AS replacement_gravesite_id,
    target_gravesites.sort_order,
    ST_Multi(ST_MakeEnvelope(
      source_record.west_longitude,
      source_record.south_latitude + (source_record.north_latitude - source_record.south_latitude) * target_gravesites.sort_order / 4,
      source_record.east_longitude,
      source_record.south_latitude + (source_record.north_latitude - source_record.south_latitude) * (target_gravesites.sort_order + 1) / 4,
      4326
    ))::geometry(MultiPolygon, 4326) AS replacement_geometry
  FROM source_record
  CROSS JOIN target_gravesites
  WHERE source_record.north_latitude > source_record.south_latitude
),
inserted_gravesites AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, replacement_name, facility_id, section_id, block_id, lot_id,
    replacement_grave_id, replacement_gravesite_id, cost, replacement_geometry, 4.00, 10.00, status_type_id,
    'operational',
    'Fit into the open corridor north of unchanged TLC-GPS-0311 and south of TLC-GPS-0312; marker TLC-HS-0311 intentionally unchanged.',
    'estimated',
    replacement_name || ' assigned to ' || replacement_grave_id || ' in the four-gravesite King stack north of unchanged C-0311 on 2026-08-08.',
    now()
  FROM replacement_gravesites
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
    source_record.id AS william_gravesite_uuid,
    source_record.headstone_uuid,
    max(inserted_gravesites.id::text) FILTER (WHERE inserted_gravesites.gravesite_id = 'TLC-GPS-0311-01')::uuid AS elizabeth_gravesite_uuid,
    max(inserted_gravesites.id::text) FILTER (WHERE inserted_gravesites.gravesite_id = 'TLC-GPS-0311-02')::uuid AS lorena_gravesite_uuid,
    max(inserted_gravesites.id::text) FILTER (WHERE inserted_gravesites.gravesite_id = 'TLC-GPS-0311-03')::uuid AS coretta_gravesite_uuid,
    max(inserted_gravesites.id::text) FILTER (WHERE inserted_gravesites.gravesite_id = 'TLC-GPS-0311-04')::uuid AS anna_gravesite_uuid
  FROM source_record
  CROSS JOIN inserted_gravesites
  GROUP BY source_record.id, source_record.headstone_uuid
),
william_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.william_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0311',
      first_name = 'William F',
      last_name = 'King',
      full_name = 'William F King',
      birth_date = DATE '1856-01-01',
      birth_date_text = '1856',
      death_date = DATE '1931-01-01',
      death_date_text = '1931',
      updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND burials.gravesite_id = 'TLC-GPS-0311'
    AND lower(COALESCE(burials.full_name, '')) = 'william f king'
  RETURNING burials.id
),
elizabeth_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.elizabeth_gravesite_uuid,
      gravesite_id = 'TLC-GPS-0311-01',
      first_name = 'Elizabeth',
      last_name = 'King',
      full_name = 'Elizabeth King',
      birth_date = DATE '1860-01-01',
      birth_date_text = '1860',
      death_date = DATE '1950-01-01',
      death_date_text = '1950',
      notes = concat_ws(' ', NULLIF(burials.notes, ''), 'Separated from the combined Elizabeth, Lorena, Coretta King record using the TLC-HS-0311 inscription on 2026-08-08.'),
      updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND burials.gravesite_id = 'TLC-GPS-0311'
    AND lower(COALESCE(burials.full_name, '')) = 'elizabeth, lorena, coretta king'
  RETURNING burials.*
),
inserted_family_burials AS (
  INSERT INTO burials (
    gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date,
    funeral_home, veteran, notes, gravesite_id, military_branch_type_id, military_war_service_type_id,
    interment_type_id, birth_date_text, death_date_text, maiden_name, military_rank_type_id,
    burial_record_status_type_id, data_confidence, review_status, review_notes, source_conflict,
    source_properties, reviewed_by, reviewed_at, death_place_uuid, updated_at
  )
  SELECT
    family.gravesite_uuid, family.first_name, 'King', family.first_name || ' King',
    elizabeth_burial.sex, family.birth_date, family.death_date, NULL, elizabeth_burial.burial_date,
    elizabeth_burial.funeral_home, elizabeth_burial.veteran,
    concat_ws(' ', NULLIF(elizabeth_burial.notes, ''), family.first_name || ' King separated into a distinct burial record using the TLC-HS-0311 inscription on 2026-08-08.'),
    family.gravesite_id, elizabeth_burial.military_branch_type_id, elizabeth_burial.military_war_service_type_id,
    elizabeth_burial.interment_type_id, family.birth_date_text, family.death_date_text, NULL,
    elizabeth_burial.military_rank_type_id, elizabeth_burial.burial_record_status_type_id,
    elizabeth_burial.data_confidence, elizabeth_burial.review_status, elizabeth_burial.review_notes,
    false, elizabeth_burial.source_properties, elizabeth_burial.reviewed_by, elizabeth_burial.reviewed_at,
    NULL, now()
  FROM elizabeth_burial
  CROSS JOIN marker_context
  CROSS JOIN LATERAL (
    VALUES
      ('Lorena', DATE '1881-01-01', DATE '1924-01-01', '1881', '1924', marker_context.lorena_gravesite_uuid, 'TLC-GPS-0311-02'),
      ('Coretta', DATE '1888-01-01', DATE '1961-01-01', '1888', '1961', marker_context.coretta_gravesite_uuid, 'TLC-GPS-0311-03'),
      ('Anna', DATE '1884-01-01', DATE '1971-01-01', '1884', '1971', marker_context.anna_gravesite_uuid, 'TLC-GPS-0311-04')
  ) AS family(first_name, birth_date, death_date, birth_date_text, death_date_text, gravesite_uuid, gravesite_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM burials existing
    WHERE existing.deleted_at IS NULL
      AND lower(COALESCE(existing.full_name, '')) = lower(family.first_name || ' King')
      AND existing.gravesite_id = family.gravesite_id
  )
  RETURNING id, gravesite_id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, william_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL SELECT headstone_uuid, elizabeth_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL SELECT headstone_uuid, lorena_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL SELECT headstone_uuid, coretta_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL SELECT headstone_uuid, anna_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, inserted_family_burials.id
  FROM marker_context
  CROSS JOIN inserted_family_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.william_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
