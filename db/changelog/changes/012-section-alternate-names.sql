--liquibase formatted sql

--changeset cemeterymapping:012-section-alternate-names splitStatements:false
ALTER TABLE sections
  ADD COLUMN alternate_names text[] NOT NULL DEFAULT '{}';

UPDATE sections
SET alternate_names = (
    SELECT array_agg(DISTINCT alias ORDER BY alias)
    FROM unnest(alternate_names || ARRAY['OC', 'Original Cemetery']::text[]) AS alias
    WHERE btrim(alias) <> ''
  ),
  updated_at = now()
WHERE section_id IN ('B', 'D')
  AND deleted_at IS NULL;

--rollback ALTER TABLE sections DROP COLUMN IF EXISTS alternate_names;
