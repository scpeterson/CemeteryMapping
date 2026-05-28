--liquibase formatted sql

--changeset cemeterymapping:022-deed-registry-allocation-raw-text-width
ALTER TABLE deed_registry_entry_allocations
  ALTER COLUMN raw_text TYPE text;

--rollback ALTER TABLE deed_registry_entry_allocations ALTER COLUMN raw_text TYPE varchar(500);
