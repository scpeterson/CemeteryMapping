--liquibase formatted sql

--changeset cemeterymapping:085-headstone-vase-material-placement-notes splitStatements:false
CREATE TABLE IF NOT EXISTS headstone_vase_material_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS headstone_vase_placement_types (
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
  ('unknown', 'Unknown', 'A vase is recorded, but the type has not been identified.', 5)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO headstone_vase_material_types (code, label, description, sort_order)
VALUES
  ('unknown', 'Unknown', 'Vase material has not been identified.', 10),
  ('bronze', 'Bronze', 'Bronze vase or vase component.', 20),
  ('granite', 'Granite', 'Granite vase or vase component.', 30),
  ('metal', 'Metal', 'Metal vase or vase component where the specific metal is not known.', 40),
  ('plastic', 'Plastic', 'Plastic vase or vase insert.', 50),
  ('other', 'Other', 'Known vase material that is not represented by the current controlled list.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO headstone_vase_placement_types (code, label, description, sort_order)
VALUES
  ('unknown', 'Unknown', 'Vase placement has not been identified.', 10),
  ('in_ground', 'In ground', 'Vase is installed in or recessed into the ground.', 20),
  ('flush', 'Flush', 'Vase is flush with the marker, base, or surrounding surface.', 30),
  ('upright', 'Upright', 'Vase stands above grade.', 40),
  ('attached_to_marker', 'Attached to marker', 'Vase is mounted to or integrated with the marker or monument.', 50),
  ('separate', 'Separate', 'Vase is separate from the marker or monument but associated with the grave.', 60),
  ('other', 'Other', 'Known vase placement that is not represented by the current controlled list.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE headstones
  ADD COLUMN IF NOT EXISTS vase_material_type_id uuid REFERENCES headstone_vase_material_types(id),
  ADD COLUMN IF NOT EXISTS vase_placement_type_id uuid REFERENCES headstone_vase_placement_types(id),
  ADD COLUMN IF NOT EXISTS vase_notes text;

CREATE INDEX IF NOT EXISTS headstones_vase_material_type_id_idx
  ON headstones (vase_material_type_id);

CREATE INDEX IF NOT EXISTS headstones_vase_placement_type_id_idx
  ON headstones (vase_placement_type_id);

DROP TRIGGER IF EXISTS touch_headstone_vase_material_types_updated_at ON headstone_vase_material_types;
CREATE TRIGGER touch_headstone_vase_material_types_updated_at
  BEFORE UPDATE ON headstone_vase_material_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_headstone_vase_placement_types_updated_at ON headstone_vase_placement_types;
CREATE TRIGGER touch_headstone_vase_placement_types_updated_at
  BEFORE UPDATE ON headstone_vase_placement_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_headstone_vase_material_types_changes ON headstone_vase_material_types;
CREATE TRIGGER audit_headstone_vase_material_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_vase_material_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_headstone_vase_placement_types_changes ON headstone_vase_placement_types;
CREATE TRIGGER audit_headstone_vase_placement_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_vase_placement_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_headstone_vase_placement_types_changes ON headstone_vase_placement_types;
--rollback DROP TRIGGER IF EXISTS audit_headstone_vase_material_types_changes ON headstone_vase_material_types;
--rollback DROP TRIGGER IF EXISTS touch_headstone_vase_placement_types_updated_at ON headstone_vase_placement_types;
--rollback DROP TRIGGER IF EXISTS touch_headstone_vase_material_types_updated_at ON headstone_vase_material_types;
--rollback DROP INDEX IF EXISTS headstones_vase_placement_type_id_idx;
--rollback DROP INDEX IF EXISTS headstones_vase_material_type_id_idx;
--rollback ALTER TABLE headstones DROP COLUMN IF EXISTS vase_notes, DROP COLUMN IF EXISTS vase_placement_type_id, DROP COLUMN IF EXISTS vase_material_type_id;
--rollback DROP TABLE IF EXISTS headstone_vase_placement_types;
--rollback DROP TABLE IF EXISTS headstone_vase_material_types;
