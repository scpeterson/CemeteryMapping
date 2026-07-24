--liquibase formatted sql

--changeset cemeterymapping:254-report-text-search-indexes
CREATE INDEX IF NOT EXISTS headstones_headstone_id_trgm_idx
  ON headstones USING gin (lower(headstone_id) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS burials_report_name_trgm_idx
  ON burials USING gin (
    lower(COALESCE(NULLIF(full_name, ''), btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')))) gin_trgm_ops
  )
  WHERE deleted_at IS NULL;

--rollback DROP INDEX IF EXISTS burials_report_name_trgm_idx;
--rollback DROP INDEX IF EXISTS headstones_headstone_id_trgm_idx;
