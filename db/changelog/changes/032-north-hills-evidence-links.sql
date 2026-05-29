--liquibase formatted sql

--changeset cemeterymapping:032-north-hills-evidence-links splitStatements:false
CREATE TABLE north_hills_ocr_entry_gravesite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES north_hills_ocr_entries(id) ON DELETE CASCADE,
  gravesite_uuid uuid NOT NULL REFERENCES gravesites(id) ON DELETE CASCADE,
  status varchar(50) NOT NULL DEFAULT 'linked',
  confidence varchar(50) NOT NULL DEFAULT 'review',
  notes varchar(4000),
  reviewed_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_by_external_subject varchar(300),
  reviewed_by_email varchar(320),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT north_hills_gravesite_links_unique UNIQUE (entry_id, gravesite_uuid),
  CONSTRAINT north_hills_gravesite_links_status_check CHECK (status IN ('linked', 'rejected', 'needs_field_check')),
  CONSTRAINT north_hills_gravesite_links_confidence_check CHECK (confidence IN ('high', 'medium', 'low', 'review'))
);

CREATE TABLE north_hills_ocr_entry_headstone_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES north_hills_ocr_entries(id) ON DELETE CASCADE,
  headstone_uuid uuid NOT NULL REFERENCES headstones(id) ON DELETE CASCADE,
  status varchar(50) NOT NULL DEFAULT 'linked',
  confidence varchar(50) NOT NULL DEFAULT 'review',
  notes varchar(4000),
  reviewed_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_by_external_subject varchar(300),
  reviewed_by_email varchar(320),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT north_hills_headstone_links_unique UNIQUE (entry_id, headstone_uuid),
  CONSTRAINT north_hills_headstone_links_status_check CHECK (status IN ('linked', 'rejected', 'needs_field_check')),
  CONSTRAINT north_hills_headstone_links_confidence_check CHECK (confidence IN ('high', 'medium', 'low', 'review'))
);

CREATE INDEX north_hills_gravesite_links_entry_idx ON north_hills_ocr_entry_gravesite_links (entry_id, status);
CREATE INDEX north_hills_gravesite_links_gravesite_idx ON north_hills_ocr_entry_gravesite_links (gravesite_uuid, status);
CREATE INDEX north_hills_headstone_links_entry_idx ON north_hills_ocr_entry_headstone_links (entry_id, status);
CREATE INDEX north_hills_headstone_links_headstone_idx ON north_hills_ocr_entry_headstone_links (headstone_uuid, status);

CREATE TRIGGER touch_north_hills_gravesite_links_updated_at
  BEFORE UPDATE ON north_hills_ocr_entry_gravesite_links
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_north_hills_headstone_links_updated_at
  BEFORE UPDATE ON north_hills_ocr_entry_headstone_links
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_north_hills_gravesite_links_changes
  AFTER INSERT OR UPDATE OR DELETE ON north_hills_ocr_entry_gravesite_links
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_north_hills_headstone_links_changes
  AFTER INSERT OR UPDATE OR DELETE ON north_hills_ocr_entry_headstone_links
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_north_hills_headstone_links_changes ON north_hills_ocr_entry_headstone_links;
--rollback DROP TRIGGER IF EXISTS audit_north_hills_gravesite_links_changes ON north_hills_ocr_entry_gravesite_links;
--rollback DROP TRIGGER IF EXISTS touch_north_hills_headstone_links_updated_at ON north_hills_ocr_entry_headstone_links;
--rollback DROP TRIGGER IF EXISTS touch_north_hills_gravesite_links_updated_at ON north_hills_ocr_entry_gravesite_links;
--rollback DROP INDEX IF EXISTS north_hills_headstone_links_headstone_idx;
--rollback DROP INDEX IF EXISTS north_hills_headstone_links_entry_idx;
--rollback DROP INDEX IF EXISTS north_hills_gravesite_links_gravesite_idx;
--rollback DROP INDEX IF EXISTS north_hills_gravesite_links_entry_idx;
--rollback DROP TABLE IF EXISTS north_hills_ocr_entry_headstone_links;
--rollback DROP TABLE IF EXISTS north_hills_ocr_entry_gravesite_links;
