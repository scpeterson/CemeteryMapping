--liquibase formatted sql

--changeset codex:318-ownership-deed-register-status
ALTER TABLE ownership_events
  ADD COLUMN deed_register_on_file boolean NOT NULL DEFAULT false;

--rollback ALTER TABLE ownership_events DROP COLUMN deed_register_on_file;
