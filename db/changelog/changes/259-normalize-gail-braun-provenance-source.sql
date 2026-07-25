--liquibase formatted sql

--changeset cemeterymapping:259-normalize-gail-braun-provenance-source splitStatements:false
UPDATE headstones
SET
  source_properties = jsonb_set(
    COALESCE(source_properties, '{}'::jsonb),
    '{NormalizedProvenance,verificationSourceType}',
    to_jsonb('manual_review'::text),
    true
  ),
  updated_at = now()
WHERE headstone_id = 'TLC-HS-0267A'
  AND deleted_at IS NULL
  AND source_properties #>> '{NormalizedProvenance,verificationSourceType}' = 'field_photo';

UPDATE burials
SET
  source_properties = jsonb_set(
    COALESCE(source_properties, '{}'::jsonb),
    '{NormalizedProvenance,verificationSourceType}',
    to_jsonb('manual_review'::text),
    true
  ),
  updated_at = now()
WHERE deleted_at IS NULL
  AND lower(trim(COALESCE(first_name, ''))) = 'gail a'
  AND lower(trim(COALESCE(last_name, ''))) = 'braun'
  AND birth_date = DATE '1947-04-15'
  AND death_date = DATE '2025-03-17'
  AND source_properties #>> '{NormalizedProvenance,verificationSourceType}' = 'field_photo';

--rollback empty
