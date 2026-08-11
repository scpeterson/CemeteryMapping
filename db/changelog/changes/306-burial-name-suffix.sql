--liquibase formatted sql

--changeset cemeterymapping:306-burial-name-suffix
ALTER TABLE burials
  ADD COLUMN name_suffix text;

COMMENT ON COLUMN burials.name_suffix IS
  'A suffix, professional credential, or post-nominal title displayed after the burial name, such as Jr., Ph.D., or M.D.';

--rollback ALTER TABLE burials DROP COLUMN IF EXISTS name_suffix;
