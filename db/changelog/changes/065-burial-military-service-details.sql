--liquibase formatted sql

--changeset cemeterymapping:065-burial-military-service-details splitStatements:false
ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS military_branch varchar(100),
  ADD COLUMN IF NOT EXISTS military_wars varchar(500);

CREATE INDEX IF NOT EXISTS burials_military_branch_trgm_idx
  ON burials USING gin (lower(military_branch) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS burials_military_wars_trgm_idx
  ON burials USING gin (lower(military_wars) gin_trgm_ops);

--rollback DROP INDEX IF EXISTS burials_military_wars_trgm_idx;
--rollback DROP INDEX IF EXISTS burials_military_branch_trgm_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS military_wars, DROP COLUMN IF EXISTS military_branch;
