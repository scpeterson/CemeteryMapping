--liquibase formatted sql

--changeset cemeterymapping:339-link-c-0359-bette-brandt-headstone splitStatements:false
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0359-02' AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM headstones
    JOIN burials ON lower(COALESCE(burials.full_name, '')) = 'bette c brandt'
      AND burials.gravesite_id = 'TLC-GPS-0359-02'
      AND burials.deleted_at IS NULL
    WHERE headstones.headstone_id = 'TLC-HS-0359'
      AND headstones.deleted_at IS NULL
  ),
  'active TLC-HS-0359 and Bette C Brandt burial in TLC-GPS-0359-02 must exist'
);

INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
SELECT headstones.id, burials.id
FROM headstones
JOIN burials
  ON lower(COALESCE(burials.full_name, '')) = 'bette c brandt'
 AND burials.gravesite_id = 'TLC-GPS-0359-02'
 AND burials.deleted_at IS NULL
WHERE headstones.headstone_id = 'TLC-HS-0359'
  AND headstones.deleted_at IS NULL
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL;

--rollback UPDATE headstone_burials SET deleted_at = now(), delete_reason = 'Rollback of TLC-HS-0359 Bette C Brandt link.' WHERE headstone_uuid IN (SELECT id FROM headstones WHERE headstone_id = 'TLC-HS-0359') AND burial_uuid IN (SELECT id FROM burials WHERE lower(COALESCE(full_name, '')) = 'bette c brandt' AND gravesite_id = 'TLC-GPS-0359-02');
