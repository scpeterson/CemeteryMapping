--liquibase formatted sql

--changeset cemeterymapping:366-add-burial-source-url
ALTER TABLE burials
  ADD COLUMN source_url varchar(2000);

COMMENT ON COLUMN burials.source_url IS
  'Optional web page used as an information source for this burial record.';

--rollback ALTER TABLE burials DROP COLUMN source_url;
