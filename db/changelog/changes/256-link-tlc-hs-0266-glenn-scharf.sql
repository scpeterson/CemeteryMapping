--liquibase formatted sql

--changeset cemeterymapping:256-link-tlc-hs-0266-glenn-scharf splitStatements:false
INSERT INTO headstone_burials (
  headstone_uuid,
  burial_uuid
)
SELECT
  headstones.id,
  burials.id
FROM headstones
JOIN gravesites
  ON gravesites.gravesite_id = 'TLC-GPS-0266-01'
 AND gravesites.deleted_at IS NULL
JOIN burials
  ON burials.gravesite_uuid = gravesites.id
 AND burials.deleted_at IS NULL
 AND lower(trim(COALESCE(burials.first_name, ''))) = 'glenn s'
 AND lower(trim(COALESCE(burials.last_name, ''))) = 'scharf'
WHERE headstones.headstone_id = 'TLC-HS-0266'
  AND headstones.deleted_at IS NULL
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback empty
