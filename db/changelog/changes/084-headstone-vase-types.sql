--liquibase formatted sql

--changeset cemeterymapping:084-headstone-vase-types splitStatements:false
CREATE TABLE IF NOT EXISTS headstone_vase_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO headstone_vase_types (code, label, description, sort_order)
VALUES
  ('present_unknown_type', 'Present, type unknown', 'A vase is present, but its style or placement has not been identified.', 10),
  ('in_ground', 'In-ground vase', 'A vase installed in the ground or recessed into the grave area.', 20),
  ('flush', 'Flush vase', 'A vase installed flush with a marker, base, or surrounding surface.', 30),
  ('upright', 'Upright vase', 'A freestanding or upright vase above grade.', 40),
  ('attached_to_marker', 'Attached to marker', 'A vase mounted to or integrated with the marker or monument.', 50),
  ('separate', 'Separate vase', 'A separate vase or vase holder associated with the marker or gravesite.', 60),
  ('missing_or_removed', 'Missing or removed', 'Evidence indicates a vase was expected or previously present, but it is missing or removed.', 70),
  ('other', 'Other', 'Known vase condition or type that is not represented by the current controlled list.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE headstones
  ADD COLUMN IF NOT EXISTS vase_type_id uuid REFERENCES headstone_vase_types(id);

CREATE INDEX IF NOT EXISTS headstones_vase_type_id_idx
  ON headstones (vase_type_id);

DROP TRIGGER IF EXISTS touch_headstone_vase_types_updated_at ON headstone_vase_types;
CREATE TRIGGER touch_headstone_vase_types_updated_at
  BEFORE UPDATE ON headstone_vase_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_headstone_vase_types_changes ON headstone_vase_types;
CREATE TRIGGER audit_headstone_vase_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_vase_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_headstone_vase_types_changes ON headstone_vase_types;
--rollback DROP TRIGGER IF EXISTS touch_headstone_vase_types_updated_at ON headstone_vase_types;
--rollback DROP INDEX IF EXISTS headstones_vase_type_id_idx;
--rollback ALTER TABLE headstones DROP COLUMN IF EXISTS vase_type_id;
--rollback DROP TABLE IF EXISTS headstone_vase_types;
