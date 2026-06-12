--liquibase formatted sql

--changeset cemeterymapping:078-split-c-0175-wolf-gravesites splitStatements:false
WITH right_side_graves AS (
  SELECT
    north_grave.geometry AS north_reference_geometry,
    south_grave.geometry AS south_reference_geometry,
    ST_XMin(Box2D(north_grave.geometry)) AS shared_east_longitude,
    ST_XMax(Box2D(north_grave.geometry)) - ST_XMin(Box2D(north_grave.geometry)) AS gravesite_width_longitude
  FROM gravesites north_grave
  JOIN gravesites south_grave
    ON south_grave.deleted_at IS NULL
   AND south_grave.gravesite_id = 'TLC-GPS-0166-02'
  WHERE north_grave.deleted_at IS NULL
    AND north_grave.gravesite_id = 'TLC-GPS-0166-01'
),
aligned_geometries AS (
  SELECT
    ST_Multi(
      ST_MakeEnvelope(
        shared_east_longitude - gravesite_width_longitude,
        ST_YMin(Box2D(north_reference_geometry)),
        shared_east_longitude,
        ST_YMax(Box2D(north_reference_geometry)),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS ethel_geometry,
    ST_Multi(
      ST_MakeEnvelope(
        shared_east_longitude - gravesite_width_longitude,
        ST_YMin(Box2D(south_reference_geometry)),
        shared_east_longitude,
        ST_YMax(Box2D(south_reference_geometry)),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS herman_geometry,
    ST_SetSRID(
      ST_MakePoint(
        shared_east_longitude - gravesite_width_longitude,
        ST_YMin(Box2D(north_reference_geometry))
      ),
      4326
    )::geometry(Point, 4326) AS shared_headstone_geometry
  FROM right_side_graves
),
c_0175_source AS (
  SELECT gravesites.*
  FROM gravesites
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN ('TLC-GPS-0175', 'TLC-GPS-0175-01')
  ORDER BY gravesites.gravesite_id = 'TLC-GPS-0175' DESC
  LIMIT 1
),
ethel_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Ethel A Wolf',
    grave_id = '0175A',
    gravesite_id = 'TLC-GPS-0175-01',
    geometry = aligned_geometries.ethel_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    updated_at = now()
  FROM c_0175_source
  CROSS JOIN aligned_geometries
  WHERE gravesites.id = c_0175_source.id
  RETURNING gravesites.*
),
herman_gravesite AS (
  INSERT INTO gravesites (
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    name,
    facility_id,
    section_id,
    block_id,
    lot_id,
    grave_id,
    gravesite_id,
    cost,
    geometry,
    width_feet,
    length_feet,
    status_type_id,
    updated_at
  )
  SELECT
    c_0175_source.cemetery_id,
    c_0175_source.section_uuid,
    c_0175_source.block_uuid,
    c_0175_source.lot_uuid,
    'Herman L Wolf',
    c_0175_source.facility_id,
    c_0175_source.section_id,
    c_0175_source.block_id,
    c_0175_source.lot_id,
    '0175B',
    'TLC-GPS-0175-02',
    c_0175_source.cost,
    aligned_geometries.herman_geometry,
    4.00,
    10.00,
    c_0175_source.status_type_id,
    now()
  FROM c_0175_source
  CROSS JOIN aligned_geometries
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
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING *
),
wolf_marker AS (
  SELECT
    headstones.id AS headstone_uuid,
    ethel_gravesite.id AS ethel_gravesite_uuid,
    herman_gravesite.id AS herman_gravesite_uuid,
    aligned_geometries.shared_headstone_geometry
  FROM headstones
  CROSS JOIN ethel_gravesite
  CROSS JOIN herman_gravesite
  CROSS JOIN aligned_geometries
  WHERE headstones.deleted_at IS NULL
    AND headstones.headstone_id = 'TLC-HS-0175'
),
updated_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = CASE
      WHEN lower(COALESCE(burials.full_name, '')) = 'herman l wolf' THEN wolf_marker.herman_gravesite_uuid
      ELSE wolf_marker.ethel_gravesite_uuid
    END,
    gravesite_id = CASE
      WHEN lower(COALESCE(burials.full_name, '')) = 'herman l wolf' THEN 'TLC-GPS-0175-02'
      ELSE 'TLC-GPS-0175-01'
    END,
    updated_at = now()
  FROM wolf_marker
  WHERE burials.deleted_at IS NULL
    AND (
      lower(COALESCE(burials.full_name, '')) = 'herman l wolf'
      OR lower(COALESCE(burials.full_name, '')) = 'ethel a wolf'
    )
  RETURNING burials.id
),
primary_headstone AS (
  UPDATE headstones
  SET
    gravesite_uuid = wolf_marker.ethel_gravesite_uuid,
    geometry = wolf_marker.shared_headstone_geometry,
    longitude = ST_X(wolf_marker.shared_headstone_geometry),
    latitude = ST_Y(wolf_marker.shared_headstone_geometry),
    updated_at = now()
  FROM wolf_marker
  WHERE headstones.id = wolf_marker.headstone_uuid
  RETURNING headstones.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    updated_at
  )
  SELECT headstone_uuid, ethel_gravesite_uuid, 'spans', now()
  FROM wolf_marker
  UNION ALL
  SELECT headstone_uuid, herman_gravesite_uuid, 'spans', now()
  FROM wolf_marker
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans',
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING headstone_uuid, gravesite_uuid
)
SELECT count(*) FROM updated_burials;

--rollback UPDATE burials SET gravesite_uuid = (SELECT id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0175-01'), gravesite_id = 'TLC-GPS-0175-01', updated_at = now() WHERE lower(COALESCE(full_name, '')) IN ('herman l wolf', 'ethel a wolf');
--rollback DELETE FROM headstone_gravesites WHERE gravesite_uuid = (SELECT id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0175-02');
--rollback DELETE FROM gravesites WHERE gravesite_id = 'TLC-GPS-0175-02';
--rollback UPDATE gravesites SET gravesite_id = 'TLC-GPS-0175', grave_id = '0175', name = NULL, geometry = ST_GeomFromText('MULTIPOLYGON(((-80.08015244 40.60108265039323,-80.08011642882785 40.601082650387625,-80.08011642882197 40.60109362960115,-80.08015244 40.601093629606765,-80.08015244 40.60108265039323)))', 4326), updated_at = now() WHERE gravesite_id = 'TLC-GPS-0175-01';
