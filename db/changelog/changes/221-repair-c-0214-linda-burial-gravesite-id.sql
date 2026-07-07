--liquibase formatted sql

--changeset cemeterymapping:221-repair-c-0214-linda-burial-gravesite-id splitStatements:false
UPDATE burials
SET
  gravesite_id = 'TLC-GPS-0214-02',
  updated_at = now()
FROM gravesites
WHERE burials.gravesite_uuid = gravesites.id
  AND gravesites.gravesite_id = 'TLC-GPS-0214-02'
  AND burials.deleted_at IS NULL
  AND lower(COALESCE(burials.first_name, '')) = 'linda'
  AND lower(COALESCE(burials.last_name, '')) = 'nesbitt'
  AND lower(COALESCE(burials.maiden_name, '')) = 'bartz';

--rollback UPDATE burials SET gravesite_id = 'TLC-GPS-0214' WHERE lower(COALESCE(first_name, '')) = 'linda' AND lower(COALESCE(last_name, '')) = 'nesbitt' AND lower(COALESCE(maiden_name, '')) = 'bartz';
