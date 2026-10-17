--liquibase formatted sql

--changeset cemeterymapping:347-remove-c-0424-placeholder-gravesite splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0424' AND deleted_at IS NULL
  )
  OR (
    EXISTS (
      SELECT 1 FROM gravesites
      WHERE gravesite_id = 'TLC-GPS-0423' AND deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM headstones
      WHERE headstone_id = 'TLC-HS-0423' AND deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM headstones
      WHERE headstone_id = 'TLC-HS-0424' AND deleted_at IS NULL
    )
  ),
  'active C-0423 gravesite and active TLC-HS-0423/TLC-HS-0424 markers must exist before retiring C-0424'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0424' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'louis herman wolf'
      AND gravesite_id = 'TLC-GPS-0423'
      AND deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'louis herman''s military placard'
      AND gravesite_id = 'TLC-GPS-0424'
      AND deleted_at IS NULL
  ) = 1,
  'exactly one canonical Louis Herman Wolf burial in C-0423 and one placeholder military placard burial in C-0424 must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0424' AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM headstone_relationships relationship
    JOIN headstones foot_marker ON foot_marker.id = relationship.from_headstone_uuid
    JOIN headstones monument ON monument.id = relationship.to_headstone_uuid
    WHERE foot_marker.headstone_id = 'TLC-HS-0424'
      AND monument.headstone_id = 'TLC-HS-0423'
      AND relationship.relationship_type = 'foot_marker'
      AND relationship.status = 'active'
      AND relationship.deleted_at IS NULL
  ),
  'active TLC-HS-0424 to TLC-HS-0423 foot-marker relationship must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0424' AND deleted_at IS NULL
  )
  OR (
    EXISTS (
      SELECT 1
      FROM headstone_burials marker_burial
      JOIN headstones marker ON marker.id = marker_burial.headstone_uuid
      JOIN burials placeholder ON placeholder.id = marker_burial.burial_uuid
      WHERE marker.headstone_id = 'TLC-HS-0424'
        AND lower(COALESCE(placeholder.full_name, '')) = 'louis herman''s military placard'
        AND marker_burial.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM headstone_gravesites marker_gravesite
      JOIN headstones marker ON marker.id = marker_gravesite.headstone_uuid
      JOIN gravesites placeholder ON placeholder.id = marker_gravesite.gravesite_uuid
      WHERE marker.headstone_id = 'TLC-HS-0424'
        AND placeholder.gravesite_id = 'TLC-GPS-0424'
        AND marker_gravesite.deleted_at IS NULL
    )
  ),
  'active TLC-HS-0424 links to its placeholder burial and C-0424 gravesite must exist'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0424' AND deleted_at IS NULL
  )
  OR NOT EXISTS (
    SELECT 1
    FROM gravesites placeholder
    WHERE placeholder.gravesite_id = 'TLC-GPS-0424'
      AND placeholder.deleted_at IS NULL
      AND (
        EXISTS (SELECT 1 FROM grave_features WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM gravesite_media_assets WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM maintenance_records WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM ownership_event_rights WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM owners WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM north_hills_ocr_entry_gravesite_links WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE gravesite_uuid = placeholder.id)
        OR EXISTS (SELECT 1 FROM source_person_record_links WHERE gravesite_uuid = placeholder.id)
      )
  ),
  'C-0424 must not have ownership, media, maintenance, feature, or evidence dependencies before retirement'
);

WITH record_context AS (
  SELECT
    target_gravesite.id AS target_gravesite_uuid,
    placeholder_gravesite.id AS placeholder_gravesite_uuid,
    monument.id AS monument_uuid,
    foot_marker.id AS foot_marker_uuid,
    canonical_burial.id AS canonical_burial_uuid,
    placeholder_burial.id AS placeholder_burial_uuid
  FROM gravesites target_gravesite
  JOIN gravesites placeholder_gravesite
    ON placeholder_gravesite.gravesite_id = 'TLC-GPS-0424'
   AND placeholder_gravesite.deleted_at IS NULL
  JOIN headstones monument
    ON monument.headstone_id = 'TLC-HS-0423'
   AND monument.deleted_at IS NULL
  JOIN headstones foot_marker
    ON foot_marker.headstone_id = 'TLC-HS-0424'
   AND foot_marker.deleted_at IS NULL
  JOIN burials canonical_burial
    ON lower(COALESCE(canonical_burial.full_name, '')) = 'louis herman wolf'
   AND canonical_burial.gravesite_id = 'TLC-GPS-0423'
   AND canonical_burial.deleted_at IS NULL
  JOIN burials placeholder_burial
    ON lower(COALESCE(placeholder_burial.full_name, '')) = 'louis herman''s military placard'
   AND placeholder_burial.gravesite_id = 'TLC-GPS-0424'
   AND placeholder_burial.deleted_at IS NULL
  WHERE target_gravesite.gravesite_id = 'TLC-GPS-0423'
    AND target_gravesite.deleted_at IS NULL
  LIMIT 1
),
updated_canonical_burial AS (
  UPDATE burials
  SET
    notes = concat_ws(
      ' ',
      NULLIF(burials.notes, ''),
      CASE
        WHEN COALESCE(burials.notes, '') ILIKE '%Military foot marker TLC-HS-0424 linked to this burial%'
          THEN NULL
        ELSE 'Military foot marker TLC-HS-0424 linked to this burial when placeholder C-0424 was retired on 2026-08-28.'
      END
    ),
    updated_at = now()
  FROM record_context
  WHERE burials.id = record_context.canonical_burial_uuid
  RETURNING burials.id
),
canonical_marker_burial_link AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT record_context.foot_marker_uuid, updated_canonical_burial.id
  FROM record_context CROSS JOIN updated_canonical_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
  RETURNING headstone_uuid
),
retired_placeholder_marker_burial_link AS (
  UPDATE headstone_burials
  SET
    deleted_at = now(),
    deleted_by = NULL,
    delete_reason = 'TLC-HS-0424 reassigned to canonical Louis Herman Wolf burial in C-0423.'
  FROM record_context CROSS JOIN canonical_marker_burial_link
  WHERE headstone_burials.headstone_uuid = record_context.foot_marker_uuid
    AND headstone_burials.burial_uuid = record_context.placeholder_burial_uuid
    AND headstone_burials.deleted_at IS NULL
  RETURNING headstone_burials.headstone_uuid
),
canonical_marker_gravesite_link AS (
  INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, updated_at)
  SELECT foot_marker_uuid, target_gravesite_uuid, 'footstone', now()
  FROM record_context CROSS JOIN retired_placeholder_marker_burial_link
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = 'footstone', updated_at = now(), deleted_at = NULL,
    deleted_by = NULL, delete_reason = NULL
  RETURNING headstone_uuid
),
retired_placeholder_marker_gravesite_link AS (
  UPDATE headstone_gravesites
  SET
    deleted_at = now(),
    deleted_by = NULL,
    delete_reason = 'TLC-HS-0424 is a military foot marker for C-0423; C-0424 is not a burial space.',
    updated_at = now()
  FROM record_context CROSS JOIN canonical_marker_gravesite_link
  WHERE headstone_gravesites.headstone_uuid = record_context.foot_marker_uuid
    AND headstone_gravesites.gravesite_uuid = record_context.placeholder_gravesite_uuid
    AND headstone_gravesites.deleted_at IS NULL
  RETURNING headstone_gravesites.headstone_uuid
),
updated_foot_marker AS (
  UPDATE headstones
  SET gravesite_uuid = record_context.target_gravesite_uuid, updated_at = now()
  FROM record_context CROSS JOIN retired_placeholder_marker_gravesite_link
  WHERE headstones.id = record_context.foot_marker_uuid
  RETURNING headstones.id
),
retired_placeholder_burial AS (
  UPDATE burials
  SET
    deleted_at = now(),
    deleted_by = NULL,
    delete_reason = 'Non-person military placard placeholder retired after TLC-HS-0424 was linked to Louis Herman Wolf in C-0423.',
    updated_at = now()
  FROM record_context CROSS JOIN updated_foot_marker
  WHERE burials.id = record_context.placeholder_burial_uuid
  RETURNING burials.id
)
UPDATE gravesites
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'C-0424 was a generated placeholder for military foot marker TLC-HS-0424 and is not a burial space.',
  updated_at = now()
FROM record_context CROSS JOIN retired_placeholder_burial
WHERE gravesites.id = record_context.placeholder_gravesite_uuid;

--rollback empty
