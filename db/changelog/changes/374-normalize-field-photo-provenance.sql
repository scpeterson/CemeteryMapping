--liquibase formatted sql

--changeset cemeterymapping:374-normalize-field-photo-provenance splitStatements:false
-- Keep photo filenames, hashes, GPS, dates, and inclusion evidence unchanged.
-- Correct the verification method only, including legacy records that may later be restored.
UPDATE headstones
SET source_properties = jsonb_set(source_properties,
    '{NormalizedProvenance,verificationSourceType}', '"manual_review"'::jsonb),
    updated_at = now()
WHERE source_properties #>> '{NormalizedProvenance,verificationSourceType}' = 'field_photo';

UPDATE burials
SET source_properties = jsonb_set(source_properties,
    '{NormalizedProvenance,verificationSourceType}', '"manual_review"'::jsonb),
    updated_at = now()
WHERE source_properties #>> '{NormalizedProvenance,verificationSourceType}' = 'field_photo';

-- Do not restore an invalid value on rollback.
--rollback empty
