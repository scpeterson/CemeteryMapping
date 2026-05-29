--liquibase formatted sql

--changeset cemeterymapping:031-north-hills-ocr-staging splitStatements:false
CREATE TABLE north_hills_ocr_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  source_name varchar(250) NOT NULL,
  source_path varchar(1000),
  imported_by varchar(250),
  notes varchar(4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE north_hills_ocr_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES north_hills_ocr_import_batches(id) ON DELETE CASCADE,
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  source_page_index integer NOT NULL,
  source_page_number integer,
  source_line_start integer NOT NULL,
  source_line_end integer NOT NULL,
  raw_text text NOT NULL,
  name_text varchar(500),
  surnames text[] NOT NULL DEFAULT '{}',
  parsed_section_name varchar(50),
  parsed_row_number integer,
  parsed_position_number integer,
  parsed_marker_scope varchar(50),
  marker_type_text varchar(250),
  material_text varchar(250),
  condition_text varchar(250),
  inscription_text text,
  parsed_years integer[] NOT NULL DEFAULT '{}',
  parse_confidence varchar(50) NOT NULL DEFAULT 'review',
  parse_notes text[] NOT NULL DEFAULT '{}',
  status varchar(50) NOT NULL DEFAULT 'staged',
  source_entry jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT north_hills_ocr_entries_line_unique UNIQUE (batch_id, source_page_index, source_line_start),
  CONSTRAINT north_hills_ocr_entries_confidence_check CHECK (parse_confidence IN ('high', 'medium', 'low', 'review')),
  CONSTRAINT north_hills_ocr_entries_scope_check CHECK (parsed_marker_scope IS NULL OR parsed_marker_scope IN ('single', 'couple', 'monolith', 'unknown')),
  CONSTRAINT north_hills_ocr_entries_status_check CHECK (status IN ('staged', 'reviewed', 'promoted', 'rejected')),
  CONSTRAINT north_hills_ocr_entries_page_check CHECK (source_page_index > 0),
  CONSTRAINT north_hills_ocr_entries_line_check CHECK (source_line_start > 0 AND source_line_end >= source_line_start)
);

CREATE INDEX north_hills_ocr_entries_batch_idx ON north_hills_ocr_entries (batch_id, source_page_number, parsed_section_name, parsed_row_number);
CREATE INDEX north_hills_ocr_entries_cemetery_idx ON north_hills_ocr_entries (cemetery_id, parsed_section_name, parsed_row_number, parsed_position_number);
CREATE INDEX north_hills_ocr_entries_confidence_idx ON north_hills_ocr_entries (parse_confidence, status);
CREATE INDEX north_hills_ocr_entries_name_trgm_idx ON north_hills_ocr_entries USING gin (lower(name_text) gin_trgm_ops);

CREATE TRIGGER touch_north_hills_ocr_entries_updated_at
  BEFORE UPDATE ON north_hills_ocr_entries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_north_hills_ocr_import_batches_changes
  AFTER INSERT OR UPDATE OR DELETE ON north_hills_ocr_import_batches
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_north_hills_ocr_entries_changes
  AFTER INSERT OR UPDATE OR DELETE ON north_hills_ocr_entries
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_north_hills_ocr_entries_changes ON north_hills_ocr_entries;
--rollback DROP TRIGGER IF EXISTS audit_north_hills_ocr_import_batches_changes ON north_hills_ocr_import_batches;
--rollback DROP TRIGGER IF EXISTS touch_north_hills_ocr_entries_updated_at ON north_hills_ocr_entries;
--rollback DROP TABLE IF EXISTS north_hills_ocr_entries;
--rollback DROP TABLE IF EXISTS north_hills_ocr_import_batches;
