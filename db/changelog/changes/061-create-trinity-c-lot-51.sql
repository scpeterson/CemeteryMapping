--liquibase formatted sql

--changeset cemeterymapping:061-create-trinity-c-lot-51 splitStatements:false
WITH c_0168 AS (
  SELECT gravesites.*
  FROM gravesites
  WHERE gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
    AND gravesites.gravesite_id = 'TLC-GPS-0168'
),
c_0169 AS (
  SELECT gravesites.*
  FROM gravesites
  WHERE gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
    AND gravesites.gravesite_id = 'TLC-GPS-0169'
),
available_status AS (
  SELECT gravesite_status_types.id
  FROM gravesite_status_types
  WHERE gravesite_status_types.code = 'available'
  LIMIT 1
),
lot_51_boxes AS (
  SELECT
    ST_XMin(Box2D(c_0169.geometry)) AS west_longitude,
    ST_XMax(Box2D(c_0169.geometry)) AS east_longitude,
    ST_YMax(Box2D(c_0168.geometry)) AS south_latitude,
    ST_YMax(Box2D(c_0168.geometry)) + (ST_YMax(Box2D(c_0169.geometry)) - ST_YMin(Box2D(c_0169.geometry))) AS c_0168a_north,
    ST_YMax(Box2D(c_0168.geometry)) + (ST_YMax(Box2D(c_0169.geometry)) - ST_YMin(Box2D(c_0169.geometry))) * 2 AS c_0169_north,
    ST_YMax(Box2D(c_0168.geometry)) + (ST_YMax(Box2D(c_0169.geometry)) - ST_YMin(Box2D(c_0169.geometry))) * 3 AS c_0170_north,
    ST_YMax(Box2D(c_0168.geometry)) + (ST_YMax(Box2D(c_0169.geometry)) - ST_YMin(Box2D(c_0169.geometry))) * 4 AS c_0171b_north,
    ST_YMax(Box2D(c_0168.geometry)) + (ST_YMax(Box2D(c_0169.geometry)) - ST_YMin(Box2D(c_0169.geometry))) * 5 AS c_0171a_north
  FROM c_0168
  CROSS JOIN c_0169
  WHERE ST_XMin(Box2D(c_0168.geometry)) = ST_XMin(Box2D(c_0169.geometry))
    AND ST_XMax(Box2D(c_0168.geometry)) = ST_XMax(Box2D(c_0169.geometry))
    AND ST_YMax(Box2D(c_0168.geometry)) < ST_YMin(Box2D(c_0169.geometry))
),
lot_51_geometries AS (
  SELECT
    ST_Multi(ST_MakeEnvelope(west_longitude, south_latitude, east_longitude, c_0168a_north, 4326))::geometry(MultiPolygon, 4326) AS c_0168a_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0168a_north, east_longitude, c_0169_north, 4326))::geometry(MultiPolygon, 4326) AS c_0169_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0169_north, east_longitude, c_0170_north, 4326))::geometry(MultiPolygon, 4326) AS c_0170_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0170_north, east_longitude, c_0171b_north, 4326))::geometry(MultiPolygon, 4326) AS c_0171b_geometry,
    ST_Multi(ST_MakeEnvelope(west_longitude, c_0171b_north, east_longitude, c_0171a_north, 4326))::geometry(MultiPolygon, 4326) AS c_0171a_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, (c_0168a_north + c_0169_north) / 2), 4326)::geometry(Point, 4326) AS c_0169_headstone_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, (c_0169_north + c_0170_north) / 2), 4326)::geometry(Point, 4326) AS c_0170_headstone_geometry,
    ST_SetSRID(ST_MakePoint(west_longitude, c_0171b_north), 4326)::geometry(Point, 4326) AS c_0171_headstone_geometry
  FROM lot_51_boxes
),
target_gravesites AS (
  SELECT
    c_0169.cemetery_id,
    c_0169.section_uuid,
    c_0169.facility_id,
    c_0169.section_id,
    lot_51_geometries.c_0168a_geometry AS geometry
  FROM c_0169
  CROSS JOIN lot_51_geometries
  UNION ALL
  SELECT c_0169.cemetery_id, c_0169.section_uuid, c_0169.facility_id, c_0169.section_id, lot_51_geometries.c_0169_geometry
  FROM c_0169
  CROSS JOIN lot_51_geometries
  UNION ALL
  SELECT c_0169.cemetery_id, c_0169.section_uuid, c_0169.facility_id, c_0169.section_id, lot_51_geometries.c_0170_geometry
  FROM c_0169
  CROSS JOIN lot_51_geometries
  UNION ALL
  SELECT c_0169.cemetery_id, c_0169.section_uuid, c_0169.facility_id, c_0169.section_id, lot_51_geometries.c_0171b_geometry
  FROM c_0169
  CROSS JOIN lot_51_geometries
  UNION ALL
  SELECT c_0169.cemetery_id, c_0169.section_uuid, c_0169.facility_id, c_0169.section_id, lot_51_geometries.c_0171a_geometry
  FROM c_0169
  CROSS JOIN lot_51_geometries
),
lot_geometry AS (
  SELECT
    cemetery_id,
    section_uuid,
    facility_id,
    section_id,
    ST_Multi(
      ST_Buffer(
        ST_UnaryUnion(ST_Collect(geometry)),
        0
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM target_gravesites
  GROUP BY cemetery_id, section_uuid, facility_id, section_id
  HAVING count(*) = 5
),
upserted_lot AS (
  INSERT INTO lots (
    cemetery_id,
    section_uuid,
    name,
    facility_id,
    section_id,
    block_id,
    lot_id,
    width_feet,
    length_feet,
    geometry,
    updated_at
  )
  SELECT
    cemetery_id,
    section_uuid,
    'C-51',
    facility_id,
    section_id,
    NULL,
    '51',
    20.00,
    20.00,
    geometry,
    now()
  FROM lot_geometry
  ON CONFLICT (facility_id, section_id, lot_id) WHERE block_id IS NULL DO UPDATE SET
    cemetery_id = EXCLUDED.cemetery_id,
    section_uuid = EXCLUDED.section_uuid,
    name = EXCLUDED.name,
    width_feet = EXCLUDED.width_feet,
    length_feet = EXCLUDED.length_feet,
    geometry = EXCLUDED.geometry,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING id
),
updated_existing_gravesites AS (
  UPDATE gravesites
  SET
    lot_uuid = upserted_lot.id,
    lot_id = '51',
    geometry = CASE gravesites.gravesite_id
      WHEN 'TLC-GPS-0169' THEN lot_51_geometries.c_0169_geometry
      WHEN 'TLC-GPS-0170' THEN lot_51_geometries.c_0170_geometry
      WHEN 'TLC-GPS-0171-01' THEN lot_51_geometries.c_0171a_geometry
      WHEN 'TLC-GPS-0171-02' THEN lot_51_geometries.c_0171b_geometry
      ELSE gravesites.geometry
    END,
    width_feet = 4.00,
    length_feet = 10.00,
    updated_at = now()
  FROM upserted_lot
  CROSS JOIN lot_51_geometries
  WHERE gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
    AND gravesites.gravesite_id IN (
      'TLC-GPS-0171-01',
      'TLC-GPS-0171-02',
      'TLC-GPS-0170',
      'TLC-GPS-0169'
    )
  RETURNING gravesites.id
),
new_empty_gravesite AS (
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
    c_0169.cemetery_id,
    c_0169.section_uuid,
    c_0169.block_uuid,
    upserted_lot.id,
    'Available gravesite in Section C lot 51',
    c_0169.facility_id,
    c_0169.section_id,
    c_0169.block_id,
    '51',
    '0168A',
    'TLC-LOT-51-0168A',
    NULL,
    lot_51_geometries.c_0168a_geometry,
    4.00,
    10.00,
    available_status.id,
    now()
  FROM c_0169
  CROSS JOIN available_status
  CROSS JOIN lot_51_geometries
  CROSS JOIN upserted_lot
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
  RETURNING id
)
UPDATE headstones
SET
  geometry = CASE headstones.headstone_id
    WHEN 'TLC-HS-0169' THEN lot_51_geometries.c_0169_headstone_geometry
    WHEN 'TLC-HS-0170' THEN lot_51_geometries.c_0170_headstone_geometry
    WHEN 'TLC-HS-0171' THEN lot_51_geometries.c_0171_headstone_geometry
    ELSE headstones.geometry
  END,
  longitude = ST_X(
    CASE headstones.headstone_id
      WHEN 'TLC-HS-0169' THEN lot_51_geometries.c_0169_headstone_geometry
      WHEN 'TLC-HS-0170' THEN lot_51_geometries.c_0170_headstone_geometry
      WHEN 'TLC-HS-0171' THEN lot_51_geometries.c_0171_headstone_geometry
      ELSE headstones.geometry
    END
  ),
  latitude = ST_Y(
    CASE headstones.headstone_id
      WHEN 'TLC-HS-0169' THEN lot_51_geometries.c_0169_headstone_geometry
      WHEN 'TLC-HS-0170' THEN lot_51_geometries.c_0170_headstone_geometry
      WHEN 'TLC-HS-0171' THEN lot_51_geometries.c_0171_headstone_geometry
      ELSE headstones.geometry
    END
  ),
  updated_at = now()
FROM lot_51_geometries
WHERE headstones.deleted_at IS NULL
  AND headstones.headstone_id IN ('TLC-HS-0169', 'TLC-HS-0170', 'TLC-HS-0171')
  AND EXISTS (SELECT 1 FROM updated_existing_gravesites)
  AND EXISTS (SELECT 1 FROM new_empty_gravesite);

--rollback WITH target_lot AS (SELECT id FROM lots WHERE section_id = 'C' AND lot_id = '51' AND block_id IS NULL) UPDATE gravesites SET lot_uuid = NULL, lot_id = NULL, updated_at = now() FROM target_lot WHERE gravesites.lot_uuid = target_lot.id AND gravesites.gravesite_id IN ('TLC-GPS-0171-01', 'TLC-GPS-0171-02', 'TLC-GPS-0170', 'TLC-GPS-0169', 'TLC-LOT-51-0168A');
--rollback DELETE FROM gravesites WHERE gravesite_id = 'TLC-LOT-51-0168A' AND NOT EXISTS (SELECT 1 FROM burials WHERE burials.gravesite_uuid = gravesites.id) AND NOT EXISTS (SELECT 1 FROM owners WHERE owners.gravesite_uuid = gravesites.id) AND NOT EXISTS (SELECT 1 FROM headstones WHERE headstones.gravesite_uuid = gravesites.id) AND NOT EXISTS (SELECT 1 FROM headstone_gravesites WHERE headstone_gravesites.gravesite_uuid = gravesites.id) AND NOT EXISTS (SELECT 1 FROM gravesite_media_assets WHERE gravesite_media_assets.gravesite_uuid = gravesites.id) AND NOT EXISTS (SELECT 1 FROM north_hills_ocr_entry_gravesite_links WHERE north_hills_ocr_entry_gravesite_links.gravesite_uuid = gravesites.id);
--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id = '51' AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
