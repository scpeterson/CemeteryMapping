--liquibase formatted sql

--changeset cemeterymapping:120-burial-record-status-and-split-c-0188 splitStatements:false
CREATE TABLE IF NOT EXISTS burial_record_status_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO burial_record_status_types (code, label, description, sort_order)
VALUES
  ('interred', 'Interred', 'The person is known or presumed to be buried or interred in the gravesite.', 10),
  ('pre_need_inscription', 'Pre-need inscription', 'The person is inscribed on a marker for a future use but is not known to be deceased or interred.', 20),
  ('memorial', 'Memorial only', 'The person is memorialized at the gravesite or marker, but burial or interment is not known to be at this location.', 30),
  ('unknown', 'Unknown', 'The relationship between the person record and an actual interment is not known.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS burial_record_status_type_id uuid REFERENCES burial_record_status_types(id);

UPDATE burials
SET burial_record_status_type_id = burial_record_status_types.id
FROM burial_record_status_types
WHERE burials.burial_record_status_type_id IS NULL
  AND burial_record_status_types.code = 'interred';

ALTER TABLE burials
  ALTER COLUMN burial_record_status_type_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS burials_record_status_type_id_idx
  ON burials (burial_record_status_type_id);

DROP TRIGGER IF EXISTS touch_burial_record_status_types_updated_at ON burial_record_status_types;
CREATE TRIGGER touch_burial_record_status_types_updated_at
  BEFORE UPDATE ON burial_record_status_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_burial_record_status_types_changes ON burial_record_status_types;
CREATE TRIGGER audit_burial_record_status_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON burial_record_status_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0188'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id IN ('TLC-GPS-0188', 'TLC-GPS-0188-02')
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  ORDER BY gravesites.gravesite_id = 'TLC-GPS-0188' DESC
  LIMIT 1
),
projected_corners AS (
  SELECT
    source_record.*,
    headstone_point AS shared_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry AS north_west_corner,
    ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry AS south_west_corner
  FROM source_record
),
replacement_geometries AS (
  SELECT
    projected_corners.*,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            shared_west_corner,
            ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(north_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            north_west_corner,
            shared_west_corner
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            south_west_corner,
            ST_Project(south_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(shared_west_corner::geography, 10 * 0.3048, pi() / 2)::geometry,
            shared_west_corner,
            south_west_corner
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS south_geometry
  FROM projected_corners
),
ronald_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Ronald Michael Jancosko',
    grave_id = '0188B',
    gravesite_id = 'TLC-GPS-0188-02',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0188 using fixed marker TLC-HS-0188 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Ronald Michael Jancosko assigned to the southern gravesite as a pre-need marker inscription when splitting shared Jancosko marker on 2026-06-19.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING
    gravesites.*,
    replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry
),
carol_gravesite AS (
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
    geometry_type,
    geometry_source,
    geometry_confidence,
    geometry_notes,
    updated_at
  )
  SELECT
    cemetery_id,
    section_uuid,
    block_uuid,
    lot_uuid,
    'Carol Lynne Jancosko',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0188A',
    'TLC-GPS-0188-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Split from TLC-GPS-0188 using fixed marker TLC-HS-0188 as shared north/south boundary.',
    'estimated',
    'Carol Lynne Jancosko assigned to the northern gravesite when splitting shared Jancosko marker on 2026-06-19.',
    now()
  FROM ronald_gravesite
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
    ronald_gravesite.id AS ronald_gravesite_uuid,
    carol_gravesite.id AS carol_gravesite_uuid,
    ronald_gravesite.headstone_uuid
  FROM ronald_gravesite
  CROSS JOIN carol_gravesite
),
updated_ronald_record AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.ronald_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0188-02',
    burial_record_status_type_id = (
      SELECT id
      FROM burial_record_status_types
      WHERE code = 'pre_need_inscription'
    ),
    burial_date = NULL,
    updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'ronald michael jancosko'
  RETURNING burials.id
),
updated_carol_record AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.carol_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0188-01',
    burial_record_status_type_id = (
      SELECT id
      FROM burial_record_status_types
      WHERE code = 'interred'
    ),
    updated_at = now()
  FROM marker_context
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'carol lynne jancosko/krizovany'
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    updated_at
  )
  SELECT headstone_uuid, carol_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, ronald_gravesite_uuid, 'spans', now()
  FROM marker_context
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'spans',
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, gravesite_uuid
),
marker_burial_links AS (
  INSERT INTO headstone_burials (
    headstone_uuid,
    burial_uuid
  )
  SELECT marker_context.headstone_uuid, updated_ronald_record.id
  FROM marker_context
  CROSS JOIN updated_ronald_record
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_carol_record.id
  FROM marker_context
  CROSS JOIN updated_carol_record
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.carol_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback UPDATE headstones SET gravesite_uuid = (SELECT id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0188-02') WHERE headstone_id = 'TLC-HS-0188';
--rollback UPDATE burials SET burial_record_status_type_id = (SELECT id FROM burial_record_status_types WHERE code = 'interred') WHERE lower(COALESCE(full_name, '')) = 'ronald michael jancosko';
--rollback ALTER TABLE burials DROP CONSTRAINT IF EXISTS burials_burial_record_status_type_id_fkey;
--rollback DROP INDEX IF EXISTS burials_record_status_type_id_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS burial_record_status_type_id;
--rollback DROP TRIGGER IF EXISTS audit_burial_record_status_types_changes ON burial_record_status_types;
--rollback DROP TRIGGER IF EXISTS touch_burial_record_status_types_updated_at ON burial_record_status_types;
--rollback DROP TABLE IF EXISTS burial_record_status_types;
