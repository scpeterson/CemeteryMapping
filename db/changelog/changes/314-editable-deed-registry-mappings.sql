--liquibase formatted sql

--changeset cemeterymapping:314-editable-deed-registry-mappings splitStatements:false
ALTER TABLE deed_registry_entries
  ADD COLUMN modern_section varchar(100),
  ADD COLUMN corrected_lot_text varchar(500),
  ADD COLUMN mapping_updated_by varchar(320),
  ADD COLUMN mapping_updated_at timestamptz;

CREATE INDEX deed_registry_entries_modern_mapping_idx
  ON deed_registry_entries (batch_id, modern_section, corrected_lot_text)
  WHERE modern_section IS NOT NULL OR corrected_lot_text IS NOT NULL;

--rollback DROP INDEX IF EXISTS deed_registry_entries_modern_mapping_idx;
--rollback ALTER TABLE deed_registry_entries DROP COLUMN IF EXISTS mapping_updated_at, DROP COLUMN IF EXISTS mapping_updated_by, DROP COLUMN IF EXISTS corrected_lot_text, DROP COLUMN IF EXISTS modern_section;
