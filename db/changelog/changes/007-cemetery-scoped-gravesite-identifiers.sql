--liquibase formatted sql

--changeset scpeterson:007-cemetery-scoped-gravesite-identifiers splitStatements:false
ALTER TABLE gravesites
  DROP CONSTRAINT IF EXISTS gravesites_identifier_unique;

ALTER TABLE gravesites
  ALTER COLUMN cemetery_id SET NOT NULL;

ALTER TABLE gravesites
  ADD CONSTRAINT gravesites_cemetery_identifier_unique UNIQUE (cemetery_id, gravesite_id);

CREATE INDEX gravesites_cemetery_gravesite_idx
  ON gravesites (cemetery_id, gravesite_id);

--rollback DROP INDEX IF EXISTS gravesites_cemetery_gravesite_idx;
--rollback ALTER TABLE gravesites DROP CONSTRAINT IF EXISTS gravesites_cemetery_identifier_unique;
--rollback ALTER TABLE gravesites ALTER COLUMN cemetery_id DROP NOT NULL;
--rollback ALTER TABLE gravesites ADD CONSTRAINT gravesites_identifier_unique UNIQUE (gravesite_id);
