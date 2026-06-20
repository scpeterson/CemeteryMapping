--liquibase formatted sql

--changeset cemeterymapping:122-bedstead-grave-feature splitStatements:false
INSERT INTO grave_feature_types (code, label, description, sort_order)
VALUES
  ('bedstead_cradle_grave', 'Bedstead / cradle grave', 'Raised grave edging, coping, rails, or frame forming a bedstead or cradle-like grave feature.', 30)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

WITH feature_type AS (
  SELECT id
  FROM grave_feature_types
  WHERE code = 'bedstead_cradle_grave'
)
INSERT INTO grave_feature_subtypes (grave_feature_type_id, code, label, description, sort_order)
VALUES
  ((SELECT id FROM feature_type), 'grave_coping_or_curb', 'Grave coping / curb', 'Raised stone, concrete, or masonry edging around a grave.', 60),
  ((SELECT id FROM feature_type), 'side_rails', 'Side rails', 'Raised side rails running along the grave, often forming a bedstead appearance.', 70),
  ((SELECT id FROM feature_type), 'full_bedstead_frame', 'Full bedstead frame', 'A headstone with raised side and/or foot elements forming a full bedstead or cradle grave frame.', 80)
ON CONFLICT (code) DO UPDATE SET
  grave_feature_type_id = EXCLUDED.grave_feature_type_id,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

INSERT INTO grave_feature_material_types (code, label, description, sort_order)
VALUES
  ('concrete', 'Concrete', 'Concrete feature or component.', 60),
  ('sandstone', 'Sandstone', 'Sandstone feature or component.', 70),
  ('limestone', 'Limestone', 'Limestone feature or component.', 80)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

--rollback UPDATE grave_feature_subtypes SET is_active = false, updated_at = now() WHERE code IN ('grave_coping_or_curb', 'side_rails', 'full_bedstead_frame');
--rollback UPDATE grave_feature_material_types SET is_active = false, updated_at = now() WHERE code IN ('concrete', 'sandstone', 'limestone');
--rollback UPDATE grave_feature_types SET is_active = false, updated_at = now() WHERE code = 'bedstead_cradle_grave';
