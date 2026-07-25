--liquibase formatted sql

--changeset cemeterymapping:255-split-c-0266-scharf-gravesites splitStatements:false
WITH source_record AS (
  SELECT
    gravesites.*,
    headstones.id AS headstone_uuid,
    ST_SetSRID(headstones.geometry, 4326) AS headstone_point
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0266'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0266'
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
edward_gravesite AS (
  UPDATE gravesites
  SET
    name = 'Edward G Scharf',
    geometry = replacement_geometries.south_geometry,
    width_feet = 4.00,
    length_feet = 10.00,
    geometry_type = 'operational',
    geometry_source = 'Split from TLC-GPS-0266 using fixed marker TLC-HS-0266 as shared north/south boundary.',
    geometry_confidence = 'estimated',
    geometry_notes = concat_ws(
      ' ',
      NULLIF(gravesites.geometry_notes, ''),
      'Edward G Scharf retained in original gravesite C-0266 and moved south when splitting shared Scharf marker on 2026-07-25.'
    ),
    updated_at = now()
  FROM replacement_geometries
  WHERE gravesites.id = replacement_geometries.id
  RETURNING
    gravesites.*,
    replacement_geometries.headstone_uuid,
    replacement_geometries.north_geometry
),
katherine_gravesite AS (
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
    'Katherine A Scharf / Glenn S Scharf (urn)',
    facility_id,
    section_id,
    block_id,
    lot_id,
    '0266A',
    'TLC-GPS-0266-01',
    cost,
    north_geometry,
    4.00,
    10.00,
    status_type_id,
    'operational',
    'Split from TLC-GPS-0266 using fixed marker TLC-HS-0266 as shared north/south boundary.',
    'estimated',
    'Katherine A Scharf and Glenn S Scharf assigned to the new northern gravesite C-0266A when splitting shared Scharf marker on 2026-07-25. Glenn is recorded as a separate urn burial pending verification.',
    now()
  FROM edward_gravesite
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
    edward_gravesite.id AS edward_gravesite_uuid,
    katherine_gravesite.id AS katherine_gravesite_uuid,
    edward_gravesite.headstone_uuid
  FROM edward_gravesite
  CROSS JOIN katherine_gravesite
),
linked_scharf_burials AS (
  SELECT burials.*
  FROM burials
  JOIN headstone_burials
    ON headstone_burials.burial_uuid = burials.id
   AND headstone_burials.deleted_at IS NULL
  JOIN marker_context
    ON marker_context.headstone_uuid = headstone_burials.headstone_uuid
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.last_name, '')) = 'scharf'
),
combined_katherine_glenn AS (
  SELECT *
  FROM linked_scharf_burials
  WHERE lower(COALESCE(first_name, '')) LIKE '%glenn%'
    AND lower(COALESCE(first_name, '')) LIKE '%katherine%'
  LIMIT 1
),
updated_edward_burial AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.edward_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0266',
    updated_at = now()
  FROM marker_context
  WHERE burials.id IN (
    SELECT id
    FROM linked_scharf_burials
    WHERE lower(split_part(trim(COALESCE(first_name, '')), ' ', 1)) = 'edward'
  )
  RETURNING burials.id
),
updated_katherine_burial AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.katherine_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0266-01',
    first_name = 'Katherine A',
    last_name = 'Scharf',
    full_name = 'Katherine A Scharf',
    maiden_name = 'Hays',
    birth_date = DATE '1900-06-10',
    birth_date_text = '1900-06-10',
    death_date = DATE '1975-02-11',
    death_date_text = '1975-02-11',
    interment_type_id = (
      SELECT id FROM burial_interment_types WHERE code = 'casket'
    ),
    notes = concat_ws(
      ' ',
      NULLIF(burials.notes, ''),
      'Katherine A Scharf separated from the combined Glenn S, Katherine A Scharf burial record using the TLC-HS-0266 inscription on 2026-07-25.'
    ),
    updated_at = now()
  FROM marker_context, combined_katherine_glenn
  WHERE burials.id = combined_katherine_glenn.id
  RETURNING burials.id
),
existing_glenn_burial AS (
  SELECT id
  FROM linked_scharf_burials
  WHERE lower(split_part(trim(COALESCE(first_name, '')), ' ', 1)) = 'glenn'
    AND id NOT IN (SELECT id FROM combined_katherine_glenn)
  LIMIT 1
),
inserted_glenn_burial AS (
  INSERT INTO burials (
    gravesite_uuid,
    first_name,
    last_name,
    full_name,
    sex,
    birth_date,
    death_date,
    burial_date,
    funeral_home,
    veteran,
    notes,
    gravesite_id,
    interment_type_id,
    birth_date_text,
    death_date_text,
    burial_record_status_type_id,
    data_confidence,
    review_status,
    review_notes,
    source_conflict,
    source_properties,
    updated_at
  )
  SELECT
    marker_context.katherine_gravesite_uuid,
    'Glenn S',
    'Scharf',
    'Glenn S Scharf',
    combined_katherine_glenn.sex,
    DATE '1932-01-01',
    DATE '1998-11-11',
    combined_katherine_glenn.burial_date,
    combined_katherine_glenn.funeral_home,
    'No',
    concat_ws(
      ' ',
      NULLIF(combined_katherine_glenn.notes, ''),
      'Glenn S Scharf separated from the combined Glenn S, Katherine A Scharf burial record using the TLC-HS-0266 inscription on 2026-07-25. Recorded as an urn burial in Katherine A Scharf''s gravesite pending verification.'
    ),
    'TLC-GPS-0266-01',
    (SELECT id FROM burial_interment_types WHERE code = 'urn'),
    '1932-01-01',
    '1998-11-11',
    combined_katherine_glenn.burial_record_status_type_id,
    combined_katherine_glenn.data_confidence,
    'needs_review',
    'Verify with cemetery records that Glenn S Scharf is an urn burial in the same gravesite as Katherine A Scharf.',
    false,
    combined_katherine_glenn.source_properties,
    now()
  FROM marker_context
  CROSS JOIN combined_katherine_glenn
  WHERE NOT EXISTS (SELECT 1 FROM existing_glenn_burial)
  RETURNING id
),
glenn_burial AS (
  SELECT id FROM existing_glenn_burial
  UNION ALL
  SELECT id FROM inserted_glenn_burial
),
updated_glenn_burial AS (
  UPDATE burials
  SET
    gravesite_uuid = marker_context.katherine_gravesite_uuid,
    gravesite_id = 'TLC-GPS-0266-01',
    first_name = 'Glenn S',
    last_name = 'Scharf',
    full_name = 'Glenn S Scharf',
    birth_date = DATE '1932-01-01',
    birth_date_text = '1932-01-01',
    death_date = DATE '1998-11-11',
    death_date_text = '1998-11-11',
    interment_type_id = (
      SELECT id FROM burial_interment_types WHERE code = 'urn'
    ),
    review_status = 'needs_review',
    review_notes = 'Verify with cemetery records that Glenn S Scharf is an urn burial in the same gravesite as Katherine A Scharf.',
    notes = CASE
      WHEN COALESCE(burials.notes, '') ILIKE '%Recorded as an urn burial in Katherine A Scharf''s gravesite pending verification.%'
        THEN burials.notes
      ELSE concat_ws(
        ' ',
        NULLIF(burials.notes, ''),
        'Recorded as an urn burial in Katherine A Scharf''s gravesite pending verification.'
      )
    END,
    updated_at = now()
  FROM marker_context, glenn_burial
  WHERE burials.id = glenn_burial.id
  RETURNING burials.id
),
marker_gravesite_links AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    updated_at
  )
  SELECT headstone_uuid, katherine_gravesite_uuid, 'spans', now()
  FROM marker_context
  UNION ALL
  SELECT headstone_uuid, edward_gravesite_uuid, 'spans', now()
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
  SELECT marker_context.headstone_uuid, updated_edward_burial.id
  FROM marker_context
  CROSS JOIN updated_edward_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_katherine_burial.id
  FROM marker_context
  CROSS JOIN updated_katherine_burial
  UNION ALL
  SELECT marker_context.headstone_uuid, updated_glenn_burial.id
  FROM marker_context
  CROSS JOIN updated_glenn_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid, burial_uuid
)
UPDATE headstones
SET
  gravesite_uuid = marker_context.edward_gravesite_uuid,
  updated_at = now()
FROM marker_context
WHERE headstones.id = marker_context.headstone_uuid;

--rollback empty
