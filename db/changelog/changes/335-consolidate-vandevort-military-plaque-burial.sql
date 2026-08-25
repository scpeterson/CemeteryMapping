--liquibase formatted sql

--changeset cemeterymapping:335-consolidate-vandevort-military-plaque-burial splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0428' AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM headstones
    WHERE headstone_id = 'TLC-HS-0428' AND deleted_at IS NULL
  ),
  'active military plaque TLC-HS-0428 must exist for active gravesite TLC-GPS-0428'
);

SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0428' AND deleted_at IS NULL
  )
  OR (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'david lynn vandevort'
      AND gravesite_id = 'TLC-GPS-0427'
      AND deleted_at IS NULL
  ) = 1
  AND (
    SELECT count(*) FROM burials
    WHERE lower(COALESCE(full_name, '')) = 'david l vandevort'
      AND gravesite_id = 'TLC-GPS-0428'
      AND deleted_at IS NULL
  ) = 1,
  'exactly one canonical C-0427 David Lynn Vandevort burial and one duplicate C-0428 David L Vandevort burial must exist'
);

WITH record_context AS (
  SELECT
    headstones.id AS plaque_uuid,
    canonical.id AS canonical_burial_uuid,
    duplicate.id AS duplicate_burial_uuid,
    duplicate.military_branch_type_id AS duplicate_branch_type_id,
    duplicate.military_rank_type_id AS duplicate_rank_type_id,
    duplicate.military_war_service_type_id AS duplicate_war_service_type_id
  FROM headstones
  JOIN burials canonical
    ON lower(COALESCE(canonical.full_name, '')) = 'david lynn vandevort'
   AND canonical.gravesite_id = 'TLC-GPS-0427'
   AND canonical.deleted_at IS NULL
  JOIN burials duplicate
    ON lower(COALESCE(duplicate.full_name, '')) = 'david l vandevort'
   AND duplicate.gravesite_id = 'TLC-GPS-0428'
   AND duplicate.deleted_at IS NULL
  WHERE headstones.headstone_id = 'TLC-HS-0428'
    AND headstones.deleted_at IS NULL
  LIMIT 1
),
updated_canonical_burial AS (
  UPDATE burials
  SET
    veteran = 'Yes',
    military_branch_type_id = COALESCE(burials.military_branch_type_id, record_context.duplicate_branch_type_id),
    military_rank_type_id = COALESCE(burials.military_rank_type_id, record_context.duplicate_rank_type_id),
    military_war_service_type_id = COALESCE(burials.military_war_service_type_id, record_context.duplicate_war_service_type_id),
    notes = concat_ws(
      ' ',
      NULLIF(burials.notes, ''),
      CASE
        WHEN COALESCE(burials.notes, '') ILIKE '%Military plaque TLC-HS-0428 linked to this canonical burial%'
          THEN NULL
        ELSE 'Military plaque TLC-HS-0428 linked to this canonical burial when duplicate C-0428 burial was retired on 2026-08-25.'
      END
    ),
    updated_at = now()
  FROM record_context
  WHERE burials.id = record_context.canonical_burial_uuid
  RETURNING burials.id
),
canonical_plaque_link AS (
  INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
  SELECT record_context.plaque_uuid, updated_canonical_burial.id
  FROM record_context CROSS JOIN updated_canonical_burial
  ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  RETURNING headstone_uuid
),
retired_duplicate_plaque_link AS (
  UPDATE headstone_burials
  SET
    deleted_at = now(),
    deleted_by = NULL,
    delete_reason = 'TLC-HS-0428 reassigned to canonical David Lynn Vandevort burial in C-0427.'
  FROM record_context CROSS JOIN canonical_plaque_link
  WHERE headstone_burials.headstone_uuid = record_context.plaque_uuid
    AND headstone_burials.burial_uuid = record_context.duplicate_burial_uuid
    AND headstone_burials.deleted_at IS NULL
  RETURNING headstone_burials.burial_uuid
)
UPDATE burials
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'Duplicate David L Vandevort burial retired after military plaque TLC-HS-0428 was linked to canonical C-0427 burial.',
  updated_at = now()
FROM record_context CROSS JOIN retired_duplicate_plaque_link
WHERE burials.id = record_context.duplicate_burial_uuid;

--rollback empty
