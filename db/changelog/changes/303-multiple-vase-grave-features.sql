--liquibase formatted sql

--changeset cemeterymapping:303-multiple-vase-grave-features splitStatements:false
INSERT INTO grave_feature_types (code, label, description, sort_order)
VALUES (
  'vase',
  'Vase',
  'An individual vase associated with a marker or gravesite. Record each vase as a separate feature so one marker may have multiple vases.',
  40
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

--rollback UPDATE grave_feature_types SET is_active = false, updated_at = now() WHERE code = 'vase';
