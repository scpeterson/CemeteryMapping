--liquibase formatted sql

--changeset cemeterymapping:404-burial-name-prefix
ALTER TABLE burials
  ADD COLUMN name_prefix text;

COMMENT ON COLUMN burials.name_prefix IS
  'An honorific or title displayed before the burial name, such as Rev., Reverend, or Dr.';

--rollback ALTER TABLE burials DROP COLUMN IF EXISTS name_prefix;
