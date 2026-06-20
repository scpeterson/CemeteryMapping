--liquibase formatted sql

--changeset cemeterymapping:121-maintenance-records splitStatements:false
CREATE TABLE IF NOT EXISTS maintenance_issue_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_action_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_priority_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO maintenance_issue_types (code, label, description, sort_order)
VALUES
  ('needs_cleaning', 'Needs cleaning', 'Marker or grave area should be cleaned.', 10),
  ('illegible', 'Illegible', 'Inscription or marker text is difficult or impossible to read.', 20),
  ('listing', 'Listing', 'Marker is leaning or out of plumb.', 30),
  ('broken', 'Broken', 'Marker or associated feature is broken.', 40),
  ('grass_needed', 'Grass needed', 'Gravesite needs grass seed, sod, or turf restoration.', 50),
  ('needs_leveling', 'Needs leveling', 'Gravesite surface is sunken, uneven, or needs leveling.', 60),
  ('sunken_soil', 'Sunken soil', 'Soil has settled and requires fill or monitoring.', 70),
  ('vase_issue', 'Vase issue', 'Vase is missing, damaged, or needs attention.', 80),
  ('flag_holder_issue', 'Flag holder issue', 'Flag holder or veteran marker feature needs attention.', 90),
  ('other', 'Other', 'Maintenance issue not represented by the controlled list.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO maintenance_action_types (code, label, description, sort_order)
VALUES
  ('inspected', 'Inspected', 'Target was inspected without necessarily completing repair work.', 10),
  ('cleaned', 'Cleaned', 'Marker or grave area was cleaned.', 20),
  ('reset_straightened', 'Reset or straightened', 'Marker was reset, straightened, or stabilized.', 30),
  ('repaired', 'Repaired', 'Marker, feature, or gravesite issue was repaired.', 40),
  ('grass_planted', 'Grass planted', 'Grass seed, sod, or turf restoration was completed.', 50),
  ('soil_added', 'Soil added', 'Soil or fill was added.', 60),
  ('leveled', 'Leveled', 'Gravesite surface was leveled or smoothed.', 70),
  ('photo_taken', 'Photo taken', 'Photo documentation was captured.', 80),
  ('deferred', 'Deferred', 'Work was reviewed and intentionally deferred.', 90),
  ('other', 'Other', 'Maintenance action not represented by the controlled list.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO maintenance_priority_types (code, label, description, sort_order)
VALUES
  ('low', 'Low', 'Routine maintenance with no immediate risk.', 10),
  ('normal', 'Normal', 'Standard maintenance priority.', 20),
  ('high', 'High', 'Important work that should be addressed soon.', 30),
  ('urgent', 'Urgent', 'Safety, preservation, or public-facing issue needing prompt attention.', 40)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id),
  gravesite_uuid uuid REFERENCES gravesites(id),
  headstone_uuid uuid REFERENCES headstones(id),
  issue_type_id uuid REFERENCES maintenance_issue_types(id),
  action_type_id uuid REFERENCES maintenance_action_types(id),
  priority_type_id uuid NOT NULL REFERENCES maintenance_priority_types(id),
  status varchar(30) NOT NULL DEFAULT 'open',
  observed_at date NOT NULL DEFAULT CURRENT_DATE,
  completed_at date,
  performed_by varchar(200),
  source_type varchar(50) NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  delete_reason text,
  CONSTRAINT maintenance_records_target_check CHECK (gravesite_uuid IS NOT NULL OR headstone_uuid IS NOT NULL),
  CONSTRAINT maintenance_records_kind_check CHECK (issue_type_id IS NOT NULL OR action_type_id IS NOT NULL),
  CONSTRAINT maintenance_records_status_check CHECK (status IN ('open', 'scheduled', 'completed', 'deferred', 'not_needed')),
  CONSTRAINT maintenance_records_source_check CHECK (source_type IN ('manual', 'inspection', 'work_order', 'photo', 'import'))
);

CREATE INDEX IF NOT EXISTS maintenance_records_cemetery_id_idx ON maintenance_records (cemetery_id);
CREATE INDEX IF NOT EXISTS maintenance_records_gravesite_uuid_idx ON maintenance_records (gravesite_uuid) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS maintenance_records_headstone_uuid_idx ON maintenance_records (headstone_uuid) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS maintenance_records_issue_type_id_idx ON maintenance_records (issue_type_id);
CREATE INDEX IF NOT EXISTS maintenance_records_action_type_id_idx ON maintenance_records (action_type_id);
CREATE INDEX IF NOT EXISTS maintenance_records_status_idx ON maintenance_records (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS maintenance_records_observed_at_idx ON maintenance_records (observed_at);
CREATE INDEX IF NOT EXISTS maintenance_records_completed_at_idx ON maintenance_records (completed_at);

DROP TRIGGER IF EXISTS touch_maintenance_issue_types_updated_at ON maintenance_issue_types;
CREATE TRIGGER touch_maintenance_issue_types_updated_at
  BEFORE UPDATE ON maintenance_issue_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_maintenance_action_types_updated_at ON maintenance_action_types;
CREATE TRIGGER touch_maintenance_action_types_updated_at
  BEFORE UPDATE ON maintenance_action_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_maintenance_priority_types_updated_at ON maintenance_priority_types;
CREATE TRIGGER touch_maintenance_priority_types_updated_at
  BEFORE UPDATE ON maintenance_priority_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_maintenance_records_updated_at ON maintenance_records;
CREATE TRIGGER touch_maintenance_records_updated_at
  BEFORE UPDATE ON maintenance_records
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_maintenance_issue_types_changes ON maintenance_issue_types;
CREATE TRIGGER audit_maintenance_issue_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON maintenance_issue_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_maintenance_action_types_changes ON maintenance_action_types;
CREATE TRIGGER audit_maintenance_action_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON maintenance_action_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_maintenance_priority_types_changes ON maintenance_priority_types;
CREATE TRIGGER audit_maintenance_priority_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON maintenance_priority_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_maintenance_records_changes ON maintenance_records;
CREATE TRIGGER audit_maintenance_records_changes
  AFTER INSERT OR UPDATE OR DELETE ON maintenance_records
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_maintenance_records_changes ON maintenance_records;
--rollback DROP TRIGGER IF EXISTS audit_maintenance_priority_types_changes ON maintenance_priority_types;
--rollback DROP TRIGGER IF EXISTS audit_maintenance_action_types_changes ON maintenance_action_types;
--rollback DROP TRIGGER IF EXISTS audit_maintenance_issue_types_changes ON maintenance_issue_types;
--rollback DROP TRIGGER IF EXISTS touch_maintenance_records_updated_at ON maintenance_records;
--rollback DROP TRIGGER IF EXISTS touch_maintenance_priority_types_updated_at ON maintenance_priority_types;
--rollback DROP TRIGGER IF EXISTS touch_maintenance_action_types_updated_at ON maintenance_action_types;
--rollback DROP TRIGGER IF EXISTS touch_maintenance_issue_types_updated_at ON maintenance_issue_types;
--rollback DROP INDEX IF EXISTS maintenance_records_completed_at_idx;
--rollback DROP INDEX IF EXISTS maintenance_records_observed_at_idx;
--rollback DROP INDEX IF EXISTS maintenance_records_status_idx;
--rollback DROP INDEX IF EXISTS maintenance_records_action_type_id_idx;
--rollback DROP INDEX IF EXISTS maintenance_records_issue_type_id_idx;
--rollback DROP INDEX IF EXISTS maintenance_records_headstone_uuid_idx;
--rollback DROP INDEX IF EXISTS maintenance_records_gravesite_uuid_idx;
--rollback DROP INDEX IF EXISTS maintenance_records_cemetery_id_idx;
--rollback DROP TABLE IF EXISTS maintenance_records;
--rollback DROP TABLE IF EXISTS maintenance_priority_types;
--rollback DROP TABLE IF EXISTS maintenance_action_types;
--rollback DROP TABLE IF EXISTS maintenance_issue_types;
