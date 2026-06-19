--liquibase formatted sql

--changeset cemeterymapping:119-grave-feature-lookups splitStatements:false
CREATE TABLE IF NOT EXISTS grave_feature_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grave_feature_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grave_feature_type_id uuid REFERENCES grave_feature_types(id),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grave_feature_placement_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grave_feature_material_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO grave_feature_types (code, label, description, sort_order)
VALUES
  ('flag_holder', 'Flag holder', 'A separate or attached holder intended to display a flag at a grave or marker.', 10),
  ('veteran_star', 'Veteran star', 'A star-shaped veteran emblem or holder, commonly associated with military service recognition.', 20),
  ('marker_accessory', 'Marker accessory', 'An accessory associated with a marker or gravesite that is not otherwise classified.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

WITH feature_types AS (
  SELECT id, code
  FROM grave_feature_types
)
INSERT INTO grave_feature_subtypes (grave_feature_type_id, code, label, description, sort_order)
VALUES
  ((SELECT id FROM feature_types WHERE code = 'flag_holder'), 'us_veteran_star', 'U.S. Veteran star', 'A flag holder or emblem described as a U.S. Veteran star.', 10),
  ((SELECT id FROM feature_types WHERE code = 'flag_holder'), 'gar_star', 'GAR star', 'Grand Army of the Republic star or flag holder.', 20),
  ((SELECT id FROM feature_types WHERE code = 'flag_holder'), 'american_legion_star', 'American Legion star', 'American Legion star or flag holder.', 30),
  ((SELECT id FROM feature_types WHERE code = 'flag_holder'), 'vfw_star', 'VFW star', 'Veterans of Foreign Wars star or flag holder.', 40),
  ((SELECT id FROM feature_types WHERE code = 'flag_holder'), 'unknown_veteran_star', 'Unknown veteran star', 'A veteran star design that has not yet been identified.', 50),
  (NULL, 'other', 'Other', 'Known feature subtype that is not represented by the controlled list.', 900)
ON CONFLICT (code) DO UPDATE SET
  grave_feature_type_id = EXCLUDED.grave_feature_type_id,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO grave_feature_placement_types (code, label, description, sort_order)
VALUES
  ('separate', 'Separate', 'A separate feature associated with a grave or marker.', 10),
  ('attached_to_marker', 'Attached to marker', 'A feature mounted to or integrated with a marker.', 20),
  ('in_ground', 'In ground', 'A feature installed in the ground.', 30),
  ('unknown', 'Unknown', 'Placement has not been identified yet.', 900),
  ('other', 'Other', 'Known placement that is not represented by the controlled list.', 910)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO grave_feature_material_types (code, label, description, sort_order)
VALUES
  ('bronze', 'Bronze', 'Bronze feature or component.', 10),
  ('metal', 'Metal', 'Metal feature where the specific metal is not known.', 20),
  ('aluminum', 'Aluminum', 'Aluminum feature or component.', 30),
  ('iron', 'Iron', 'Iron feature or component.', 40),
  ('plastic', 'Plastic', 'Plastic feature or component.', 50),
  ('unknown', 'Unknown', 'Material has not been identified yet.', 900),
  ('other', 'Other', 'Known material that is not represented by the controlled list.', 910)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS grave_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id),
  gravesite_uuid uuid REFERENCES gravesites(id),
  headstone_uuid uuid REFERENCES headstones(id),
  feature_type_id uuid NOT NULL REFERENCES grave_feature_types(id),
  feature_subtype_id uuid REFERENCES grave_feature_subtypes(id),
  placement_type_id uuid REFERENCES grave_feature_placement_types(id),
  material_type_id uuid REFERENCES grave_feature_material_types(id),
  symbol_text varchar(200),
  source_type varchar(50) NOT NULL DEFAULT 'manual',
  source_text text,
  notes text,
  status varchar(30) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  delete_reason text,
  CONSTRAINT grave_features_target_check CHECK (gravesite_uuid IS NOT NULL OR headstone_uuid IS NOT NULL),
  CONSTRAINT grave_features_status_check CHECK (status IN ('active', 'needs_review', 'retired'))
);

CREATE INDEX IF NOT EXISTS grave_features_cemetery_id_idx ON grave_features (cemetery_id);
CREATE INDEX IF NOT EXISTS grave_features_gravesite_uuid_idx ON grave_features (gravesite_uuid) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS grave_features_headstone_uuid_idx ON grave_features (headstone_uuid) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS grave_features_feature_type_id_idx ON grave_features (feature_type_id);

DROP TRIGGER IF EXISTS touch_grave_feature_types_updated_at ON grave_feature_types;
CREATE TRIGGER touch_grave_feature_types_updated_at
  BEFORE UPDATE ON grave_feature_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_grave_feature_subtypes_updated_at ON grave_feature_subtypes;
CREATE TRIGGER touch_grave_feature_subtypes_updated_at
  BEFORE UPDATE ON grave_feature_subtypes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_grave_feature_placement_types_updated_at ON grave_feature_placement_types;
CREATE TRIGGER touch_grave_feature_placement_types_updated_at
  BEFORE UPDATE ON grave_feature_placement_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_grave_feature_material_types_updated_at ON grave_feature_material_types;
CREATE TRIGGER touch_grave_feature_material_types_updated_at
  BEFORE UPDATE ON grave_feature_material_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_grave_features_updated_at ON grave_features;
CREATE TRIGGER touch_grave_features_updated_at
  BEFORE UPDATE ON grave_features
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_grave_feature_types_changes ON grave_feature_types;
CREATE TRIGGER audit_grave_feature_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON grave_feature_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_grave_feature_subtypes_changes ON grave_feature_subtypes;
CREATE TRIGGER audit_grave_feature_subtypes_changes
  AFTER INSERT OR UPDATE OR DELETE ON grave_feature_subtypes
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_grave_feature_placement_types_changes ON grave_feature_placement_types;
CREATE TRIGGER audit_grave_feature_placement_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON grave_feature_placement_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_grave_feature_material_types_changes ON grave_feature_material_types;
CREATE TRIGGER audit_grave_feature_material_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON grave_feature_material_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_grave_features_changes ON grave_features;
CREATE TRIGGER audit_grave_features_changes
  AFTER INSERT OR UPDATE OR DELETE ON grave_features
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_grave_features_changes ON grave_features;
--rollback DROP TRIGGER IF EXISTS audit_grave_feature_material_types_changes ON grave_feature_material_types;
--rollback DROP TRIGGER IF EXISTS audit_grave_feature_placement_types_changes ON grave_feature_placement_types;
--rollback DROP TRIGGER IF EXISTS audit_grave_feature_subtypes_changes ON grave_feature_subtypes;
--rollback DROP TRIGGER IF EXISTS audit_grave_feature_types_changes ON grave_feature_types;
--rollback DROP TRIGGER IF EXISTS touch_grave_features_updated_at ON grave_features;
--rollback DROP TRIGGER IF EXISTS touch_grave_feature_material_types_updated_at ON grave_feature_material_types;
--rollback DROP TRIGGER IF EXISTS touch_grave_feature_placement_types_updated_at ON grave_feature_placement_types;
--rollback DROP TRIGGER IF EXISTS touch_grave_feature_subtypes_updated_at ON grave_feature_subtypes;
--rollback DROP TRIGGER IF EXISTS touch_grave_feature_types_updated_at ON grave_feature_types;
--rollback DROP INDEX IF EXISTS grave_features_feature_type_id_idx;
--rollback DROP INDEX IF EXISTS grave_features_headstone_uuid_idx;
--rollback DROP INDEX IF EXISTS grave_features_gravesite_uuid_idx;
--rollback DROP INDEX IF EXISTS grave_features_cemetery_id_idx;
--rollback DROP TABLE IF EXISTS grave_features;
--rollback DROP TABLE IF EXISTS grave_feature_material_types;
--rollback DROP TABLE IF EXISTS grave_feature_placement_types;
--rollback DROP TABLE IF EXISTS grave_feature_subtypes;
--rollback DROP TABLE IF EXISTS grave_feature_types;
