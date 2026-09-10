--liquibase formatted sql

--changeset cemeterymapping:378-split-a-0031-fark-gravesites splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0031' AND deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0031' AND geometry IS NOT NULL AND deleted_at IS NULL),
  'active marker TLC-HS-0031 with geometry must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0031' AND deleted_at IS NULL)
  OR (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(COALESCE(burials.full_name, '')) = 'h ernest fark'
      AND headstones.headstone_id = 'TLC-HS-0031'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    JOIN headstone_burials ON headstone_burials.burial_uuid = burials.id
    JOIN headstones ON headstones.id = headstone_burials.headstone_uuid
    WHERE lower(COALESCE(burials.full_name, '')) = 'elizabeth i fark'
      AND headstones.headstone_id = 'TLC-HS-0031'
      AND burials.deleted_at IS NULL AND headstone_burials.deleted_at IS NULL AND headstones.deleted_at IS NULL
  ) = 1,
  'exactly one linked active H Ernest Fark burial and one linked active Elizabeth I Fark burial must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites target
    WHERE target.gravesite_id = 'TLC-GPS-0031-01'
      AND (target.name IS DISTINCT FROM 'Elizabeth I Fark'
        OR target.cemetery_id IS DISTINCT FROM (
          SELECT cemetery_id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0031' AND deleted_at IS NULL
        ))
  ),
  'new gravesite TLC-GPS-0031-01 must be unused or already belong to Elizabeth I Fark in the source cemetery'
);

WITH source_record AS (
  SELECT gravesites.*, headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones ON headstones.headstone_id = 'TLC-HS-0031' AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0031'
    AND upper(COALESCE(gravesites.section_id, '')) = 'A'
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
      ST_Project(shared_west_corner::geography, 9.8 * 0.3048, pi() / 2)::geometry,
      ST_Project(north_west_corner::geography, 9.8 * 0.3048, pi() / 2)::geometry,
      north_west_corner, shared_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_west_corner,
      ST_Project(south_west_corner::geography, 9.8 * 0.3048, pi() / 2)::geometry,
      ST_Project(shared_west_corner::geography, 9.8 * 0.3048, pi() / 2)::geometry,
      shared_west_corner, south_west_corner
    ])), 4326))::geometry(MultiPolygon, 4326) AS south_geometry
  FROM projected_corners
),
ernest_gravesite AS (
  UPDATE gravesites
  SET name = 'H Ernest Fark', geometry = replacement_geometries.south_geometry,
    width_feet = 4.00, length_feet = 9.80, geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0031 using fixed marker TLC-HS-0031 as the boundary between A-0031 and A-0031A. Estimated length is 9.8 feet to avoid the Pfeiffer gravesites to the east.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ', NULLIF(gravesites.geometry_notes, ''),
      'H Ernest Fark retained in original gravesite A-0031 and moved south; Elizabeth I Fark was assigned the new grave north of the fixed shared marker on 2026-09-09.'
    ), updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING gravesites.*, replacement_geometries.headstone_uuid, replacement_geometries.north_geometry
),
elizabeth_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id, section_uuid, block_uuid, lot_uuid, name, facility_id, section_id, block_id, lot_id,
    grave_id, gravesite_id, cost, geometry, width_feet, length_feet, status_type_id,
    geometry_type, geometry_source, geometry_confidence, geometry_notes, updated_at
  )
  SELECT cemetery_id, section_uuid, block_uuid, lot_uuid, 'Elizabeth I Fark', facility_id,
    section_id, block_id, lot_id, '0031A', 'TLC-GPS-0031-01', cost, north_geometry,
    4.00, 9.80, status_type_id, 'operational',
    'Split from TLC-GPS-0031 using fixed marker TLC-HS-0031 as the boundary between A-0031 and A-0031A. Estimated length is 9.8 feet to avoid the Pfeiffer gravesites to the east.',
    'estimated', 'Elizabeth I Fark assigned to new gravesite A-0031A immediately north of A-0031 on 2026-09-09.', now()
  FROM ernest_gravesite
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
  SELECT ernest_gravesite.id AS ernest_gravesite_uuid,
    elizabeth_gravesite.id AS elizabeth_gravesite_uuid, ernest_gravesite.headstone_uuid
  FROM ernest_gravesite CROSS JOIN elizabeth_gravesite
),
updated_ernest_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.ernest_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0031', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'h ernest fark'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
updated_elizabeth_burial AS (
  UPDATE burials
  SET gravesite_uuid = marker_context.elizabeth_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0031-01', updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'elizabeth i fark'
    AND EXISTS (
      SELECT 1 FROM headstone_burials
      WHERE headstone_burials.headstone_uuid = marker_context.headstone_uuid
        AND headstone_burials.burial_uuid = burials.id AND headstone_burials.deleted_at IS NULL
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT headstone_uuid, ernest_gravesite_uuid, 'spans', now() FROM marker_context
  UNION ALL
  SELECT headstone_uuid, elizabeth_gravesite_uuid, 'spans', now() FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
),
marker_burial_links AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT marker_context.headstone_uuid, updated_ernest_burial.id
  FROM marker_context CROSS JOIN updated_ernest_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_elizabeth_burial.id
  FROM marker_context CROSS JOIN updated_elizabeth_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
)
UPDATE headstones
SET gravesite_uuid = marker_context.ernest_gravesite_uuid, updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
