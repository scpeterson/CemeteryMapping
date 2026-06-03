--liquibase formatted sql

--changeset cemeterymapping:043-drop-legacy-gravesite-status splitStatements:false
UPDATE gravesites
SET status_type_id = unknown_status.id
FROM gravesite_status_types unknown_status
WHERE gravesites.status_type_id IS NULL
  AND unknown_status.code = 'unknown';

ALTER TABLE gravesites
  ALTER COLUMN status_type_id SET NOT NULL;

DROP TRIGGER IF EXISTS sync_gravesite_status_reference_id ON gravesites;
DROP FUNCTION IF EXISTS sync_gravesite_status_reference_id();

DROP INDEX IF EXISTS gravesites_status_idx;

ALTER TABLE gravesites
  DROP CONSTRAINT IF EXISTS gravesites_status_fk,
  DROP CONSTRAINT IF EXISTS gravesites_status_code_fk,
  DROP COLUMN IF EXISTS status;

--rollback ALTER TABLE gravesites ADD COLUMN status varchar(30);
--rollback UPDATE gravesites SET status = COALESCE(gravesite_status_types.code, 'unknown') FROM gravesite_status_types WHERE gravesite_status_types.id = gravesites.status_type_id;
--rollback UPDATE gravesites SET status = 'unknown' WHERE status IS NULL;
--rollback ALTER TABLE gravesites ALTER COLUMN status SET DEFAULT 'unknown', ALTER COLUMN status SET NOT NULL;
--rollback ALTER TABLE gravesites ADD CONSTRAINT gravesites_status_code_fk FOREIGN KEY (status) REFERENCES gravesite_status_types(code);
--rollback CREATE INDEX gravesites_status_idx ON gravesites (status);
