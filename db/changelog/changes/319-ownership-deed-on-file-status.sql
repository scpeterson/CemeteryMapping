--liquibase formatted sql

--changeset codex:319-ownership-deed-on-file-status
ALTER TABLE ownership_events
  ADD COLUMN deed_on_file boolean NOT NULL DEFAULT false;

--rollback ALTER TABLE ownership_events DROP COLUMN deed_on_file;
