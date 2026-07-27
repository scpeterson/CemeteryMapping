--liquibase formatted sql

--changeset cemeterymapping:264-remove-knobloch-monolith-pseudo-burial splitStatements:false
WITH target AS (
  SELECT
    burials.id AS burial_uuid,
    headstones.id AS headstone_uuid
  FROM burials
  JOIN gravesites
    ON gravesites.id = burials.gravesite_uuid
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0284'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.gravesite_id = 'TLC-GPS-0284'
    AND gravesites.deleted_at IS NULL
    AND lower(trim(COALESCE(burials.full_name, ''))) = 'knobloch monolith'
    AND lower(trim(COALESCE(burials.last_name, ''))) = 'knobloch monolith'
    AND trim(COALESCE(burials.first_name, '')) = ''
    AND burials.deleted_at IS NULL
)
UPDATE headstone_burials
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'Removed erroneous pseudo-burial created from the Knobloch monolith marker label.'
FROM target
WHERE headstone_burials.headstone_uuid = target.headstone_uuid
  AND headstone_burials.burial_uuid = target.burial_uuid
  AND headstone_burials.deleted_at IS NULL;

UPDATE burials
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'Removed erroneous pseudo-burial created from the Knobloch monolith marker label.',
  updated_at = now()
FROM gravesites
WHERE burials.gravesite_uuid = gravesites.id
  AND gravesites.gravesite_id = 'TLC-GPS-0284'
  AND lower(trim(COALESCE(burials.full_name, ''))) = 'knobloch monolith'
  AND lower(trim(COALESCE(burials.last_name, ''))) = 'knobloch monolith'
  AND trim(COALESCE(burials.first_name, '')) = ''
  AND burials.deleted_at IS NULL;

--rollback UPDATE burials SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now() FROM gravesites WHERE burials.gravesite_uuid = gravesites.id AND gravesites.gravesite_id = 'TLC-GPS-0284' AND lower(trim(COALESCE(burials.full_name, ''))) = 'knobloch monolith' AND lower(trim(COALESCE(burials.last_name, ''))) = 'knobloch monolith' AND trim(COALESCE(burials.first_name, '')) = '';
--rollback UPDATE headstone_burials SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL FROM burials, gravesites, headstones WHERE headstone_burials.burial_uuid = burials.id AND burials.gravesite_uuid = gravesites.id AND headstone_burials.headstone_uuid = headstones.id AND gravesites.gravesite_id = 'TLC-GPS-0284' AND headstones.headstone_id = 'TLC-HS-0284' AND lower(trim(COALESCE(burials.full_name, ''))) = 'knobloch monolith';
