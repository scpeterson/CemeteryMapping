--liquibase formatted sql

--changeset cemeterymapping:056-remove-c-0173-gravesite-keep-marker splitStatements:false
WITH c_0173 AS (
  SELECT
    gravesites.id AS gravesite_uuid,
    headstones.id AS headstone_uuid
  FROM gravesites
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0173'
   AND headstones.deleted_at IS NULL
   AND headstones.gravesite_uuid = gravesites.id
  WHERE gravesites.deleted_at IS NULL
    AND gravesites.gravesite_id = 'TLC-GPS-0173'
),
soft_deleted_burials AS (
  UPDATE burials
  SET
    deleted_at = now(),
    delete_reason = 'C-0173 is a standalone graveyard marker labeled F.B.; no burial is recorded there.',
    updated_at = now()
  FROM c_0173
  WHERE burials.deleted_at IS NULL
    AND burials.gravesite_uuid = c_0173.gravesite_uuid
  RETURNING burials.id
),
soft_deleted_links AS (
  UPDATE headstone_gravesites
  SET
    deleted_at = now(),
    delete_reason = 'TLC-HS-0173 is a standalone graveyard marker and is not associated with a gravesite.',
    updated_at = now()
  FROM c_0173
  WHERE headstone_gravesites.deleted_at IS NULL
    AND headstone_gravesites.headstone_uuid = c_0173.headstone_uuid
    AND headstone_gravesites.gravesite_uuid = c_0173.gravesite_uuid
  RETURNING headstone_gravesites.id
),
soft_deleted_gravesite AS (
  UPDATE gravesites
  SET
    deleted_at = now(),
    delete_reason = 'Not a gravesite; field record is only the standalone graveyard marker TLC-HS-0173 labeled F.B.',
    updated_at = now()
  FROM c_0173
  WHERE gravesites.id = c_0173.gravesite_uuid
    AND gravesites.deleted_at IS NULL
  RETURNING gravesites.id
)
UPDATE headstones
SET
  gravesite_uuid = NULL,
  inscription = 'F.B.',
  marker_type = 'marker',
  marker_type_code = 'other',
  marker_type_id = marker_types.id,
  updated_at = now()
FROM c_0173
JOIN marker_types
  ON marker_types.code = 'other'
WHERE headstones.id = c_0173.headstone_uuid
  AND headstones.deleted_at IS NULL;

--rollback empty
