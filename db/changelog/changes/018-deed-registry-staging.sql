--liquibase formatted sql

--changeset cemeterymapping:018-deed-registry-staging splitStatements:false
CREATE TABLE deed_registry_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  source_name varchar(250) NOT NULL,
  source_path varchar(1000),
  worksheet_name varchar(250),
  imported_by varchar(250),
  notes varchar(4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE deed_registry_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES deed_registry_import_batches(id) ON DELETE CASCADE,
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  source_row_number integer NOT NULL,
  owner_last_name varchar(250),
  owner_first_names varchar(250),
  owner_display_name varchar(500),
  address varchar(250),
  city varchar(150),
  state varchar(2),
  raw_lot_text varchar(250),
  raw_section_text varchar(50),
  raw_remarks text,
  last_known_date date,
  deed_on_file varchar(50),
  deed_register_on_file varchar(50),
  parsed_section_name varchar(50),
  parsed_section_alias varchar(50),
  normalized_lot_text varchar(250),
  parsed_lot_numbers text[] NOT NULL DEFAULT '{}',
  parsed_plot_numbers text[] NOT NULL DEFAULT '{}',
  parsed_grave_numbers text[] NOT NULL DEFAULT '{}',
  parsed_grave_count integer,
  ownership_scope varchar(50) NOT NULL DEFAULT 'unknown',
  parse_confidence varchar(50) NOT NULL DEFAULT 'review',
  parse_notes text[] NOT NULL DEFAULT '{}',
  source_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(50) NOT NULL DEFAULT 'staged',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deed_registry_entries_row_unique UNIQUE (batch_id, source_row_number),
  CONSTRAINT deed_registry_entries_scope_check CHECK (ownership_scope IN ('whole_lot', 'multiple_lots', 'specific_graves', 'grave_count_only', 'passage', 'section_g_plot', 'unknown')),
  CONSTRAINT deed_registry_entries_confidence_check CHECK (parse_confidence IN ('high', 'medium', 'low', 'review')),
  CONSTRAINT deed_registry_entries_status_check CHECK (status IN ('staged', 'reviewed', 'promoted', 'rejected'))
);

CREATE TABLE deed_registry_entry_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES deed_registry_entries(id) ON DELETE CASCADE,
  allocation_type varchar(50) NOT NULL,
  section_name varchar(50),
  section_alias varchar(50),
  lot_identifier varchar(50),
  plot_identifier varchar(50),
  grave_number varchar(50),
  grave_count integer,
  raw_text varchar(500),
  parse_confidence varchar(50) NOT NULL DEFAULT 'review',
  parse_notes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deed_registry_entry_allocations_type_check CHECK (allocation_type IN ('lot', 'multiple_lot', 'passage', 'section_g_plot', 'grave_number', 'grave_count', 'unknown')),
  CONSTRAINT deed_registry_entry_allocations_confidence_check CHECK (parse_confidence IN ('high', 'medium', 'low', 'review')),
  CONSTRAINT deed_registry_entry_allocations_grave_count_check CHECK (grave_count IS NULL OR grave_count > 0)
);

CREATE INDEX deed_registry_entries_cemetery_idx ON deed_registry_entries (cemetery_id, parsed_section_name, normalized_lot_text);
CREATE INDEX deed_registry_entries_owner_trgm_idx ON deed_registry_entries USING gin (lower(owner_display_name) gin_trgm_ops);
CREATE INDEX deed_registry_entries_scope_idx ON deed_registry_entries (ownership_scope, parse_confidence, status);
CREATE INDEX deed_registry_entry_allocations_entry_idx ON deed_registry_entry_allocations (entry_id);
CREATE INDEX deed_registry_entry_allocations_lookup_idx ON deed_registry_entry_allocations (section_name, lot_identifier, plot_identifier, allocation_type);

CREATE TRIGGER touch_deed_registry_entries_updated_at
  BEFORE UPDATE ON deed_registry_entries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_deed_registry_import_batches_changes
  AFTER INSERT OR UPDATE OR DELETE ON deed_registry_import_batches
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_deed_registry_entries_changes
  AFTER INSERT OR UPDATE OR DELETE ON deed_registry_entries
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_deed_registry_entry_allocations_changes
  AFTER INSERT OR UPDATE OR DELETE ON deed_registry_entry_allocations
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_deed_registry_entry_allocations_changes ON deed_registry_entry_allocations;
--rollback DROP TRIGGER IF EXISTS audit_deed_registry_entries_changes ON deed_registry_entries;
--rollback DROP TRIGGER IF EXISTS audit_deed_registry_import_batches_changes ON deed_registry_import_batches;
--rollback DROP TRIGGER IF EXISTS touch_deed_registry_entries_updated_at ON deed_registry_entries;
--rollback DROP TABLE IF EXISTS deed_registry_entry_allocations;
--rollback DROP TABLE IF EXISTS deed_registry_entries;
--rollback DROP TABLE IF EXISTS deed_registry_import_batches;
