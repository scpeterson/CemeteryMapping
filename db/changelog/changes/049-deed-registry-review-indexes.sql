--liquibase formatted sql

--changeset cemeterymapping:049-deed-registry-review-indexes
CREATE INDEX IF NOT EXISTS deed_registry_entries_batch_row_type_idx
  ON deed_registry_entries (batch_id, (source_row->>'rowType'), source_row_number);

CREATE INDEX IF NOT EXISTS deed_registry_entries_batch_source_row_number_idx
  ON deed_registry_entries (batch_id, source_row_number);

CREATE INDEX IF NOT EXISTS deed_registry_entries_batch_owner_lower_idx
  ON deed_registry_entries (batch_id, lower(coalesce(owner_display_name, '')));

CREATE INDEX IF NOT EXISTS deed_registry_import_batches_worksheet_created_idx
  ON deed_registry_import_batches (worksheet_name, created_at DESC, id);

--rollback DROP INDEX IF EXISTS deed_registry_import_batches_worksheet_created_idx;
--rollback DROP INDEX IF EXISTS deed_registry_entries_batch_owner_lower_idx;
--rollback DROP INDEX IF EXISTS deed_registry_entries_batch_source_row_number_idx;
--rollback DROP INDEX IF EXISTS deed_registry_entries_batch_row_type_idx;
