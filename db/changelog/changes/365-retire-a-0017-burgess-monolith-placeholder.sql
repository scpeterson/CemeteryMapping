--liquibase formatted sql

--changeset cemeterymapping:365-retire-a-0017-burgess-monolith-placeholder splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0017' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1
    FROM headstones
    JOIN marker_scope_types ON marker_scope_types.id = headstones.marker_scope_type_id
    WHERE headstones.headstone_id = 'TLC-HS-0017'
      AND marker_scope_types.code = 'monolith'
      AND headstones.deleted_at IS NULL
  ),
  'active TLC-HS-0017 must be a monolith before retiring placeholder A-0017'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0017' AND deleted_at IS NULL)
  OR (
    SELECT count(*) FROM burials
    WHERE gravesite_id = 'TLC-GPS-0017' AND deleted_at IS NULL
  ) = 1
  AND EXISTS (
    SELECT 1 FROM burials
    WHERE gravesite_id = 'TLC-GPS-0017'
      AND lower(trim(COALESCE(full_name, ''))) = 'burgess monolith'
      AND deleted_at IS NULL
  ),
  'A-0017 must contain only the generated Burgess Monolith pseudo-burial'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0017' AND deleted_at IS NULL)
  OR NOT EXISTS (
    SELECT 1
    FROM gravesites placeholder
    WHERE placeholder.gravesite_id = 'TLC-GPS-0017'
      AND placeholder.deleted_at IS NULL
      AND (
        EXISTS (SELECT 1 FROM grave_features WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM maintenance_records WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM ownership_event_rights WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM owners WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM north_hills_ocr_entry_gravesite_links WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM source_person_record_links WHERE gravesite_uuid = placeholder.id)
      )
  ),
  'A-0017 must not have ownership, maintenance, feature, or evidence dependencies before retirement'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0017' AND deleted_at IS NULL)
  OR NOT EXISTS (
    SELECT 1
    FROM gravesite_media_assets grave_media
    JOIN gravesites placeholder ON placeholder.id = grave_media.gravesite_uuid
    WHERE placeholder.gravesite_id = 'TLC-GPS-0017'
      AND placeholder.deleted_at IS NULL
      AND grave_media.deleted_at IS NULL
      AND grave_media.status = 'linked'
      AND NOT EXISTS (
        SELECT 1
        FROM headstone_media_assets marker_media
        JOIN headstones marker ON marker.id = marker_media.headstone_uuid
        WHERE marker_media.media_asset_id = grave_media.media_asset_id
          AND marker.headstone_id = 'TLC-HS-0017'
          AND marker_media.deleted_at IS NULL
          AND marker_media.status = 'linked'
          AND marker.deleted_at IS NULL
      )
  ),
  'every active A-0017 photo must also be linked to TLC-HS-0017 before retirement'
);

WITH record_context AS (
  SELECT placeholder.id AS gravesite_uuid, marker.id AS marker_uuid, pseudo_burial.id AS burial_uuid
  FROM gravesites placeholder
  JOIN headstones marker
    ON marker.headstone_id = 'TLC-HS-0017' AND marker.deleted_at IS NULL
  JOIN burials pseudo_burial
    ON pseudo_burial.gravesite_uuid = placeholder.id
   AND lower(trim(COALESCE(pseudo_burial.full_name, ''))) = 'burgess monolith'
   AND pseudo_burial.deleted_at IS NULL
  WHERE placeholder.gravesite_id = 'TLC-GPS-0017' AND placeholder.deleted_at IS NULL
  LIMIT 1
),
retired_marker_burial_link AS (
  UPDATE headstone_burials
  SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Generated Burgess Monolith pseudo-burial retired; TLC-HS-0017 remains as a standalone family monument.'
  FROM record_context
  WHERE headstone_burials.headstone_uuid = record_context.marker_uuid
    AND headstone_burials.burial_uuid = record_context.burial_uuid
    AND headstone_burials.deleted_at IS NULL
  RETURNING headstone_burials.headstone_uuid
),
retired_gravesite_media_links AS (
  UPDATE gravesite_media_assets
  SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'A-0017 placeholder retired; photos remain linked directly to TLC-HS-0017.',
    updated_at = now()
  FROM record_context CROSS JOIN retired_marker_burial_link
  WHERE gravesite_media_assets.gravesite_uuid = record_context.gravesite_uuid
    AND gravesite_media_assets.deleted_at IS NULL
  RETURNING gravesite_media_assets.gravesite_uuid
),
retired_marker_gravesite_link AS (
  UPDATE headstone_gravesites
  SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'A-0017 represented the Burgess family monument location, not a burial space.',
    updated_at = now()
  FROM record_context
  WHERE headstone_gravesites.headstone_uuid = record_context.marker_uuid
    AND headstone_gravesites.gravesite_uuid = record_context.gravesite_uuid
    AND headstone_gravesites.deleted_at IS NULL
  RETURNING headstone_gravesites.headstone_uuid
),
updated_marker AS (
  UPDATE headstones
  SET gravesite_uuid = NULL, updated_at = now()
  FROM record_context CROSS JOIN retired_marker_gravesite_link
  WHERE headstones.id = record_context.marker_uuid
  RETURNING headstones.id
),
retired_pseudo_burial AS (
  UPDATE burials
  SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Generated Burgess Monolith pseudo-burial retired because the family monument is not a person or burial.',
    updated_at = now()
  FROM record_context CROSS JOIN updated_marker
  WHERE burials.id = record_context.burial_uuid
  RETURNING burials.id
)
UPDATE gravesites
SET deleted_at = now(), deleted_by = NULL,
  delete_reason = 'A-0017 was an imported placeholder for family monument TLC-HS-0017 and is not a burial space.',
  updated_at = now()
FROM record_context CROSS JOIN retired_pseudo_burial
WHERE gravesites.id = record_context.gravesite_uuid;

--rollback empty
