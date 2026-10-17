--liquibase formatted sql

--changeset cemeterymapping:441-remove-d-0462-note-placeholder-burial splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0462' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM burials b JOIN gravesites g ON g.id = b.gravesite_uuid
    WHERE g.gravesite_id = 'TLC-GPS-0462' AND g.deleted_at IS NULL
      AND b.deleted_at IS NULL AND b.full_name = 'P. S. Meyer'
  ),
  'D-0462 must retain its active P. S. Meyer burial before removing the imported note placeholder'
);

UPDATE headstone_burials hb
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed research note incorrectly imported as a burial: Check Notes on this one.'
FROM burials b, gravesites g
WHERE hb.burial_uuid = b.id AND b.gravesite_uuid = g.id
  AND g.gravesite_id = 'TLC-GPS-0462' AND g.deleted_at IS NULL
  AND b.full_name = 'Check Notes on this one'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'Check Notes on this one'
  AND b.deleted_at IS NULL AND hb.deleted_at IS NULL;

UPDATE burials b
SET deleted_at = now(), deleted_by = NULL,
    delete_reason = 'Removed research note incorrectly imported as a burial: Check Notes on this one.',
    updated_at = now()
FROM gravesites g
WHERE b.gravesite_uuid = g.id
  AND g.gravesite_id = 'TLC-GPS-0462' AND g.deleted_at IS NULL
  AND b.full_name = 'Check Notes on this one'
  AND trim(coalesce(b.first_name, '')) = '' AND b.last_name = 'Check Notes on this one'
  AND b.deleted_at IS NULL;

--rollback empty
