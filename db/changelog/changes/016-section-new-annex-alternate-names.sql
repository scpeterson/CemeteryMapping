--liquibase formatted sql

--changeset cemeterymapping:016-section-new-annex-alternate-names splitStatements:false
UPDATE sections
SET alternate_names = (
    SELECT array_agg(DISTINCT alias ORDER BY alias)
    FROM unnest(alternate_names || ARRAY['NA', 'New Annex']::text[]) AS alias
    WHERE btrim(alias) <> ''
  )
WHERE name IN ('A', 'C')
  AND deleted_at IS NULL;

--rollback UPDATE sections
--rollback SET alternate_names = array_remove(array_remove(alternate_names, 'NA'), 'New Annex')
--rollback WHERE name IN ('A', 'C')
--rollback   AND deleted_at IS NULL;
