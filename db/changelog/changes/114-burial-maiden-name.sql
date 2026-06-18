--liquibase formatted sql

--changeset cemeterymapping:114-burial-maiden-name
ALTER TABLE burials
  ADD COLUMN maiden_name varchar(150);

CREATE INDEX IF NOT EXISTS burials_maiden_name_trgm_idx
  ON burials USING gin (lower(maiden_name) gin_trgm_ops);

--rollback DROP INDEX IF EXISTS burials_maiden_name_trgm_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS maiden_name;
