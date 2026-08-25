--liquibase formatted sql

--changeset cemeterymapping:336-review-c-0428-and-unlink-military-plaque splitStatements:false
SELECT assert_migration_prerequisite(
  EXISTS (
    SELECT 1
    FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0428'
      AND deleted_at IS NULL
  ),
  'active gravesite TLC-GPS-0428 must exist'
);

SELECT assert_migration_prerequisite(
  EXISTS (
    SELECT 1
    FROM headstones
    WHERE headstone_id = 'TLC-HS-0428'
      AND deleted_at IS NULL
  ),
  'active military plaque TLC-HS-0428 must exist'
);

WITH record_context AS (
  SELECT
    headstones.id AS headstone_uuid,
    gravesites.id AS gravesite_uuid
  FROM headstones
  CROSS JOIN gravesites
  WHERE headstones.headstone_id = 'TLC-HS-0428'
    AND headstones.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0428'
    AND gravesites.deleted_at IS NULL
),
unlinked_primary_gravesite AS (
  UPDATE headstones
  SET
    gravesite_uuid = NULL,
    updated_at = now()
  FROM record_context
  WHERE headstones.id = record_context.headstone_uuid
    AND headstones.gravesite_uuid = record_context.gravesite_uuid
  RETURNING headstones.id
),
retired_gravesite_link AS (
  UPDATE headstone_gravesites
  SET
    deleted_at = now(),
    deleted_by = NULL,
    delete_reason = 'TLC-HS-0428 is a military plaque for David Lynn Vandevort and is not confirmed to mark gravesite C-0428.',
    updated_at = now()
  FROM record_context
  WHERE headstone_gravesites.headstone_uuid = record_context.headstone_uuid
    AND headstone_gravesites.gravesite_uuid = record_context.gravesite_uuid
    AND headstone_gravesites.deleted_at IS NULL
  RETURNING headstone_gravesites.id
)
UPDATE gravesites
SET
  status_type_id = needs_review_status.id,
  updated_at = now()
FROM record_context
CROSS JOIN gravesite_status_types needs_review_status
WHERE gravesites.id = record_context.gravesite_uuid
  AND needs_review_status.code = 'needs_review';

--rollback empty
