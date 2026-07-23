--liquibase formatted sql

--changeset cemeterymapping:246-burial-source-provenance
ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS source_properties jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS burials_nhg_inclusion_idx
  ON burials ((source_properties->'NormalizedProvenance'->>'nhgInclusion'))
  WHERE deleted_at IS NULL;

--rollback DROP INDEX IF EXISTS burials_nhg_inclusion_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS source_properties;
