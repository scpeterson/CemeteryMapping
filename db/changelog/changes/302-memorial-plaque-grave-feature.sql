--liquibase formatted sql

--changeset cemeterymapping:302-memorial-plaque-grave-feature splitStatements:false
INSERT INTO grave_feature_types (code, label, description, sort_order)
VALUES (
  'memorial_plaque',
  'Memorial plaque',
  'An inscribed plaque attached to or associated with a headstone or gravesite, including government-issued veteran plaques.',
  30
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

INSERT INTO grave_feature_subtypes (
  grave_feature_type_id,
  code,
  label,
  description,
  sort_order
)
SELECT
  grave_feature_types.id,
  'government_veteran_plaque',
  'Government-issued veteran plaque',
  'A government-furnished plaque identifying a veteran and military service, commonly mounted to a monument or marker.',
  10
FROM grave_feature_types
WHERE grave_feature_types.code = 'memorial_plaque'
ON CONFLICT (code) DO UPDATE SET
  grave_feature_type_id = EXCLUDED.grave_feature_type_id,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

--rollback UPDATE grave_feature_subtypes SET is_active = false, updated_at = now() WHERE code = 'government_veteran_plaque';
--rollback UPDATE grave_feature_types SET is_active = false, updated_at = now() WHERE code = 'memorial_plaque';
