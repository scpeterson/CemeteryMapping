--liquibase formatted sql

--changeset cemeterymapping:399-burial-given-name-status
ALTER TABLE burials ADD COLUMN given_name_status text
  CHECK (given_name_status IN ('recorded', 'unknown', 'no_given_name')),
  ADD COLUMN display_name text,
  ADD CONSTRAINT burials_given_name_consistency CHECK (
    given_name_status IS NULL
    OR (given_name_status = 'recorded' AND NULLIF(btrim(first_name), '') IS NOT NULL)
    OR (given_name_status IN ('unknown', 'no_given_name') AND NULLIF(btrim(first_name), '') IS NULL)
  );

COMMENT ON COLUMN burials.given_name_status IS
  'Explicit given-name status. NULL uses recorded when first_name is present, otherwise unknown. No given name requires affirmative evidence; never inferred from an empty inscription.';
COMMENT ON COLUMN burials.display_name IS
  'Optional descriptive display name, separate from structured name fields and the original marker inscription.';

--rollback ALTER TABLE burials DROP CONSTRAINT burials_given_name_consistency, DROP COLUMN display_name, DROP COLUMN given_name_status;
