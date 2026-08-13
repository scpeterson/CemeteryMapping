--liquibase formatted sql

--changeset cemeterymapping:315-editable-deed-last-known-date splitStatements:false
ALTER TABLE deed_registry_entries
  ADD COLUMN corrected_last_known_date date;

--rollback ALTER TABLE deed_registry_entries DROP COLUMN IF EXISTS corrected_last_known_date;
