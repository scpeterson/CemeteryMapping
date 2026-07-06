--liquibase formatted sql

--changeset cemeterymapping:217-source-person-record-soft-delete
ALTER TABLE source_person_records
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason text;

ALTER TABLE source_person_record_links
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason text;

CREATE INDEX source_person_records_active_idx
  ON source_person_records (cemetery_id, status, source_page_number)
  WHERE deleted_at IS NULL;

CREATE INDEX source_person_record_links_active_record_idx
  ON source_person_record_links (source_person_record_id, link_type)
  WHERE deleted_at IS NULL;

--rollback DROP INDEX IF EXISTS source_person_record_links_active_record_idx;
--rollback DROP INDEX IF EXISTS source_person_records_active_idx;
--rollback ALTER TABLE source_person_record_links DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE source_person_records DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
