--liquibase formatted sql

--changeset cemeterymapping:247-split-c-0162-eshenbaugh-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0162'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0162'
    AND upper(COALESCE(gravesites.section_id, '')) = 'C'
  LIMIT 1
),
replacement_geometries AS (
  SELECT
    source_record.*,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            headstone_point,
            ST_Project(headstone_point::geography, 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(ST_Project(headstone_point::geography, 4 * 0.3048, 0), 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(headstone_point::geography, 4 * 0.3048, 0)::geometry,
            headstone_point
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS north_geometry,
    ST_Multi(
      ST_SetSRID(
        ST_MakePolygon(
          ST_MakeLine(ARRAY[
            ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry,
            ST_Project(ST_Project(headstone_point::geography, 4 * 0.3048, pi()), 10 * 0.3048, pi() / 2)::geometry,
            ST_Project(headstone_point::geography, 10 * 0.3048, pi() / 2)::geometry,
            headstone_point,
            ST_Project(headstone_point::geography, 4 * 0.3048, pi())::geometry
          ])
        ),
        4326
      )
    )::geometry(MultiPolygon, 4326) AS south_geometry
  FROM source_record
),
donald_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Donald L Eshenbaugh',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0162 using fixed marker TLC-HS-0162 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Donald L Eshenbaugh retained in original gravesite C-0162 and moved south when splitting shared Eshenbaugh marker on 2026-07-23.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING
    gravesites.*,
    replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry
),
ella_gravesite AS (
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
    'Ella M Ford Eshenbaugh',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0162A',
    'TLC-GPS-0162-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Split from TLC-GPS-0162 using fixed marker TLC-HS-0162 as shared north/south boundary.',
    'estimated',
    'Ella M Ford Eshenbaugh assigned to the new northern gravesite C-0162A when splitting shared Eshenbaugh marker on 2026-07-23.',
    now()
  FROM donald_gravesite
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
    donald_gravesite.id AS donald_gravesite_uuid,
    ella_gravesite.id AS ella_gravesite_uuid,
    donald_gravesite.headstone_uuid
  FROM donald_gravesite
  CROSS JOIN ella_gravesite
),
eshenbaugh_burials AS (
  SELECT
    burials.id,
    lower(COALESCE(burials.full_name, '')) AS normalized_full_name,
    lower(COALESCE(burials.first_name, '')) AS normalized_first_name,
    lower(COALESCE(burials.last_name, '')) AS normalized_last_name
  FROM burials
  JOIN headstone_burials
    ON headstone_burials.burial_uuid = burials.id
   AND headstone_burials.deleted_at IS NULL
  JOIN marker_context
    ON marker_context.headstone_uuid = headstone_burials.headstone_uuid
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.last_name, '')) = 'eshenbaugh'
    AND lower(COALESCE(burials.first_name, '')) IN ('donald l', 'ella m')
),
updated_donald_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.donald_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0162',
    updated_at = now()
  FROM marker_context, eshenbaugh_burials
  WHERE burials.id = eshenbaugh_burials.id
    AND (
      eshenbaugh_burials.normalized_full_name = 'donald l eshenbaugh'
      OR (eshenbaugh_burials.normalized_first_name = 'donald l' AND eshenbaugh_burials.normalized_last_name = 'eshenbaugh')
    )
  RETURNING burials.id
),
updated_ella_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.ella_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0162-01',
    maiden_name = 'Ford',
    updated_at = now()
  FROM marker_context, eshenbaugh_burials
  WHERE burials.id = eshenbaugh_burials.id
    AND (
      eshenbaugh_burials.normalized_full_name = 'ella m eshenbaugh'
      OR (eshenbaugh_burials.normalized_first_name = 'ella m' AND eshenbaugh_burials.normalized_last_name = 'eshenbaugh')
    )
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    updated_at
  )
  SELECT headstone_uuid, ella_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, donald_gravesite_uuid, 'spans', now()
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
  SELECT marker_context.headstone_uuid, updated_donald_burials.id
  FROM marker_context
  CROSS JOIN updated_donald_burials
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_ella_burials.id
  FROM marker_context
  CROSS JOIN updated_ella_burials
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.donald_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
