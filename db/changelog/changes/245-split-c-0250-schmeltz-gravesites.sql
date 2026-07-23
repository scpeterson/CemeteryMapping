--liquibase formatted sql

--changeset cemeterymapping:245-split-c-0250-schmeltz-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS marker_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0250'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.gravesite_id = 'TLC-GPS-0250'
    AND gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
geometry_points AS (
  SELECT
    source_record.*,
    ST_Project(marker_point::geography, 6 * 0.3048, 0)::geometry AS north_outer,
    ST_Project(marker_point::geography, 2 * 0.3048, 0)::geometry AS north_inner,
    ST_Project(marker_point::geography, 2 * 0.3048, pi())::geometry AS south_inner,
    ST_Project(marker_point::geography, 6 * 0.3048, pi())::geometry AS south_outer
  FROM source_record
),
replacement_geometries AS (
  SELECT
    geometry_points.*,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      north_inner,
      ST_Project(north_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_outer::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_outer,
      north_inner
    ])), 4326))::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_inner,
      ST_Project(south_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      north_inner,
      south_inner
    ])), 4326))::geometry(MultiPolygon, 4326) AS center_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_outer,
      ST_Project(south_outer::geography, 10 * 0.3048, pi() / 2)::geometry,
      ST_Project(south_inner::geography, 10 * 0.3048, pi() / 2)::geometry,
      south_inner,
      south_outer
    ])), 4326))::geometry(MultiPolygon, 4326) AS south_geometry
  FROM geometry_points
),
george_gravesite AS (
  UPDATE gravesites
  SET
    name = 'George H Schmeltz',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Three-way split from TLC-GPS-0250 using fixed marker TLC-HS-0250.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(' ', NULLIF(gravesites.geometry_notes, ''), 'George H Schmeltz retained in original C-0250 and placed south on 2026-07-23.'),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.center_geometry, replacement_geometries.north_geometry
),
william_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'William A Schmeltz', facility_id, section_id, block_id, lot_id,
    '0250A', 'TLC-GPS-0250-01', cost, center_geometry, 4.00, 10.00, status_type_id,
    'operational', 'Three-way split from TLC-GPS-0250 using fixed marker TLC-HS-0250.', 'estimated',
    'William A Schmeltz assigned to center gravesite C-0250A on 2026-07-23.', now()
  FROM george_gravesite
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    name = EXCLUDED.name, grave_id = EXCLUDED.grave_id, geometry = EXCLUDED.geometry,
    width_feet = EXCLUDED.width_feet, length_feet = EXCLUDED.length_feet,
    geometry_type = EXCLUDED.geometry_type, geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence, geometry_notes = EXCLUDED.geometry_notes,
    updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
  RETURNING *
),
john_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT
    cemetery_id, section_uuid, block_uuid, lot_uuid, 'John A Schmeltz', facility_id, section_id, block_id, lot_id,
    '0250B', 'TLC-GPS-0250-02', cost, north_geometry, 4.00, 10.00, status_type_id,
    'operational', 'Three-way split from TLC-GPS-0250 using fixed marker TLC-HS-0250.', 'estimated',
    'John A Schmeltz assigned to northern gravesite C-0250B on 2026-07-23.', now()
  FROM george_gravesite
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    name = EXCLUDED.name, grave_id = EXCLUDED.grave_id, geometry = EXCLUDED.geometry,
    width_feet = EXCLUDED.width_feet, length_feet = EXCLUDED.length_feet,
    geometry_type = EXCLUDED.geometry_type, geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence, geometry_notes = EXCLUDED.geometry_notes,
    updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
  RETURNING *
),
marker_context AS (
  SELECT
    george_gravesite.id AS george_uuid,
    william_gravesite.id AS william_uuid,
    john_gravesite.id AS john_uuid,
    george_gravesite.headstone_uuid
  FROM george_gravesite
  CROSS JOIN william_gravesite
  CROSS JOIN john_gravesite
),
george_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.george_uuid, gravesite_id = 'TLC-GPS-0250', updated_at = now()
  FROM marker_context
  WHERE lower(COALESCE(burials.full_name, '')) = 'george heinrich schmeltz'
    AND burials.deleted_at IS NULL
  RETURNING burials.id
),
william_burial AS (
  UPDATE burials
  SET
    first_name = 'William A',
    last_name = 'Schmeltz',
    full_name = 'William A Schmeltz',
    birth_date = DATE '1874-01-01',
    birth_date_text = '1874',
    death_date = DATE '1948-01-01',
    death_date_text = '1948',
    gravesite_uuid = marker_context.william_uuid,
    gravesite_id = 'TLC-GPS-0250-01',
    notes = regexp_replace(COALESCE(burials.notes, ''), 'Person column: 2[.]', 'Person column: 2. Split into distinct William A and John A burial records on 2026-07-23.'),
    updated_at = now()
  FROM marker_context
  WHERE lower(COALESCE(burials.full_name, '')) = 'william a, john a schmeltz'
    AND burials.deleted_at IS NULL
  RETURNING burials.*
),
john_burial AS (
  INSERT INTO burials (
    gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date,
    funeral_home, veteran, notes, gravesite_id, military_branch_type_id, military_war_service_type_id,
    interment_type_id, birth_date_text, death_date_text, maiden_name, military_rank_type_id,
    burial_record_status_type_id, military_enlisted_date, military_discharged_date,
    data_confidence, review_status, review_notes, source_conflict, reviewed_by, reviewed_at, death_place_uuid,
    updated_at
  )
  SELECT
    marker_context.john_uuid, 'John A', 'Schmeltz', 'John A Schmeltz', william_burial.sex,
    DATE '1876-01-01', DATE '1918-01-01', NULL, william_burial.burial_date,
    william_burial.funeral_home, william_burial.veteran,
    regexp_replace(COALESCE(william_burial.notes, ''), 'William A and John A', 'William A and John A'),
    'TLC-GPS-0250-02', william_burial.military_branch_type_id, william_burial.military_war_service_type_id,
    william_burial.interment_type_id, '1876', '1918', NULL, william_burial.military_rank_type_id,
    william_burial.burial_record_status_type_id, william_burial.military_enlisted_date, william_burial.military_discharged_date,
    william_burial.data_confidence, william_burial.review_status, william_burial.review_notes,
    william_burial.source_conflict, william_burial.reviewed_by, william_burial.reviewed_at, NULL, now()
  FROM william_burial
  CROSS JOIN marker_context
  WHERE NOT EXISTS (
    SELECT 1 FROM burials existing
    WHERE lower(COALESCE(existing.full_name, '')) = 'john a schmeltz'
      AND existing.deleted_at IS NULL
      AND existing.gravesite_id = 'TLC-GPS-0250-02'
  )
  RETURNING id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, george_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, william_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, john_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
  RETURNING headstone_uuid
),
john_marker_link AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, john_burial.id
  FROM marker_context
  CROSS JOIN john_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.george_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
