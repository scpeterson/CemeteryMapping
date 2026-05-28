--liquibase formatted sql

--changeset cemeterymapping:019-deed-registry-staging-raw-widths
ALTER TABLE deed_registry_entries
  ALTER COLUMN state TYPE varchar(100),
  ALTER COLUMN deed_on_file TYPE varchar(100),
  ALTER COLUMN deed_register_on_file TYPE varchar(100);

--rollback ALTER TABLE deed_registry_entries
--rollback   ALTER COLUMN state TYPE varchar(2),
--rollback   ALTER COLUMN deed_on_file TYPE varchar(50),
--rollback   ALTER COLUMN deed_register_on_file TYPE varchar(50);
