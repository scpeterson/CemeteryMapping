--liquibase formatted sql

--changeset cemeterymapping:083-create-trinity-c-lot-71 splitStatements:false
WITH target_gravesites AS (
  SELECT
    gravesites.*
  FROM gravesites
  WHERE gravesites.deleted_at IS NULL
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
    AND gravesites.gravesite_id IN (
      'TLC-GPS-0177',
      'TLC-GPS-0176',
      'TLC-GPS-0175-01',
      'TLC-GPS-0175-02',
      'TLC-GPS-0174'
    )
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
    'C-71',
    facility_id,
    section_id,
    NULL,
    '71',
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
)
UPDATE gravesites
SET
  lot_uuid = upserted_lot.id,
  lot_id = '71',
  updated_at = now()
FROM upserted_lot
WHERE gravesites.deleted_at IS NULL
  AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  AND gravesites.gravesite_id IN (
    'TLC-GPS-0177',
    'TLC-GPS-0176',
    'TLC-GPS-0175-01',
    'TLC-GPS-0175-02',
    'TLC-GPS-0174'
  );

--rollback WITH target_lot AS (SELECT id FROM lots WHERE section_id = 'C' AND lot_id = '71' AND block_id IS NULL) UPDATE gravesites SET lot_uuid = NULL, lot_id = NULL, updated_at = now() FROM target_lot WHERE gravesites.lot_uuid = target_lot.id AND gravesites.gravesite_id IN ('TLC-GPS-0177', 'TLC-GPS-0176', 'TLC-GPS-0175-01', 'TLC-GPS-0175-02', 'TLC-GPS-0174');
--rollback DELETE FROM lots WHERE section_id = 'C' AND lot_id = '71' AND block_id IS NULL AND NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesites.lot_uuid = lots.id);
