--liquibase formatted sql

--changeset cemeterymapping:293-ownership-effective-date-text
ALTER TABLE ownership_events
  ADD COLUMN effective_date_text varchar(50);

UPDATE ownership_events
SET effective_date_text = effective_date::text
WHERE effective_date IS NOT NULL;

--rollback ALTER TABLE ownership_events DROP COLUMN IF EXISTS effective_date_text;
