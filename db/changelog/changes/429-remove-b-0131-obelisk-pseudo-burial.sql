--liquibase formatted sql

--changeset cemeterymapping:429-remove-b-0131-obelisk-pseudo-burial splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0131' AND deleted_at IS NULL)
  OR (
    EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0131' AND deleted_at IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM burials b JOIN gravesites g ON g.id = b.gravesite_uuid
      WHERE g.gravesite_id = 'TLC-GPS-0131' AND b.deleted_at IS NULL
        AND NOT (lower(trim(COALESCE(b.full_name, ''))) = 'beuermann obelisk'
          AND lower(trim(COALESCE(b.last_name, ''))) = 'beuermann obelisk'
          AND trim(COALESCE(b.first_name, '')) = '')
    )
  ),
  'B-0131 must have its active marker and no real-person burials before correcting the obelisk placeholder'
);

WITH target AS (
  SELECT
    burials.id AS burial_uuid,
    headstones.id AS headstone_uuid
  FROM burials
  JOIN gravesites
    ON gravesites.id = burials.gravesite_uuid
  JOIN headstones
    ON headstones.headstone_id = 'TLC-HS-0131'
   AND headstones.deleted_at IS NULL
  WHERE gravesites.gravesite_id = 'TLC-GPS-0131'
    AND gravesites.deleted_at IS NULL
    AND lower(trim(COALESCE(burials.full_name, ''))) = 'beuermann obelisk'
    AND lower(trim(COALESCE(burials.last_name, ''))) = 'beuermann obelisk'
    AND trim(COALESCE(burials.first_name, '')) = ''
    AND burials.deleted_at IS NULL
)
UPDATE headstone_burials
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'Removed erroneous pseudo-burial created from the Beuermann obelisk marker label.'
FROM target
WHERE headstone_burials.headstone_uuid = target.headstone_uuid
  AND headstone_burials.burial_uuid = target.burial_uuid
  AND headstone_burials.deleted_at IS NULL;

UPDATE burials
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'Removed erroneous pseudo-burial created from the Beuermann obelisk marker label.',
  updated_at = now()
FROM gravesites
WHERE burials.gravesite_uuid = gravesites.id
  AND gravesites.gravesite_id = 'TLC-GPS-0131'
  AND lower(trim(COALESCE(burials.full_name, ''))) = 'beuermann obelisk'
  AND lower(trim(COALESCE(burials.last_name, ''))) = 'beuermann obelisk'
  AND trim(COALESCE(burials.first_name, '')) = ''
  AND burials.deleted_at IS NULL;

--rollback UPDATE burials SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now() FROM gravesites WHERE burials.gravesite_uuid = gravesites.id AND gravesites.gravesite_id = 'TLC-GPS-0131' AND lower(trim(COALESCE(burials.full_name, ''))) = 'beuermann obelisk' AND lower(trim(COALESCE(burials.last_name, ''))) = 'beuermann obelisk' AND trim(COALESCE(burials.first_name, '')) = '';
--rollback UPDATE headstone_burials SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL FROM burials, gravesites, headstones WHERE headstone_burials.burial_uuid = burials.id AND burials.gravesite_uuid = gravesites.id AND headstone_burials.headstone_uuid = headstones.id AND gravesites.gravesite_id = 'TLC-GPS-0131' AND headstones.headstone_id = 'TLC-HS-0131' AND lower(trim(COALESCE(burials.full_name, ''))) = 'beuermann obelisk';
