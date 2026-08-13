--liquibase formatted sql

--changeset cemeterymapping:316-preserve-deed-recorded-dates splitStatements:false
ALTER TABLE deed_registry_entries
  ALTER COLUMN last_known_date TYPE varchar(50) USING last_known_date::text,
  ALTER COLUMN corrected_last_known_date TYPE varchar(50) USING corrected_last_known_date::text;

UPDATE deed_registry_entries
SET last_known_date = '1944'
WHERE lower(owner_display_name) = 'roy soergel'
  AND last_known_date = '1944-01-01';

--rollback UPDATE deed_registry_entries SET last_known_date = '1944-01-01' WHERE lower(owner_display_name) = 'roy soergel' AND last_known_date = '1944';
--rollback ALTER TABLE deed_registry_entries ALTER COLUMN last_known_date TYPE date USING last_known_date::date, ALTER COLUMN corrected_last_known_date TYPE date USING corrected_last_known_date::date;
