--liquibase formatted sql

--changeset codex:320-editable-deed-remarks
ALTER TABLE deed_registry_entries
  ADD COLUMN corrected_remarks text;

--rollback ALTER TABLE deed_registry_entries DROP COLUMN IF EXISTS corrected_remarks;
