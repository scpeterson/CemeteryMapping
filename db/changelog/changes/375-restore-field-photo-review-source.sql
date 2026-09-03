--liquibase formatted sql

--changeset cemeterymapping:375-restore-field-photo-review-source splitStatements:false
-- Restore known photo records after 374 or its manual workaround. Preserve
-- subsequently selected survey, documentary, or import sources and all evidence.
UPDATE headstones
SET source_properties = jsonb_set(source_properties,
    '{NormalizedProvenance,verificationSourceType}', '"field_photo"'::jsonb),
    updated_at = now()
WHERE headstone_id IN ('TLC-HS-0576', 'TLC-HS-0328A')
  AND deleted_at IS NULL
  AND source_properties->>'Source' = 'field photos'
  AND source_properties #>> '{NormalizedProvenance,verificationSourceType}' = 'manual_review';

UPDATE burials
SET source_properties = jsonb_set(source_properties,
    '{NormalizedProvenance,verificationSourceType}', '"field_photo"'::jsonb),
    updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0576'
  AND full_name = 'Janet Barczak McKibben'
  AND deleted_at IS NULL
  AND source_properties->>'Source' = 'field photos'
  AND source_properties #>> '{NormalizedProvenance,verificationSourceType}' = 'manual_review';

-- Retain evidence classification when rolling back unrelated schema changes.
--rollback empty
