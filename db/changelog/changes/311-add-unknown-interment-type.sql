--liquibase formatted sql

--changeset cemeterymapping:311-add-unknown-interment-type splitStatements:false
INSERT INTO burial_interment_types (code, label, description, sort_order)
VALUES (
  'unknown',
  'Unknown or not applicable',
  'The physical interment type is unknown, unverified, or not applicable to a pre-need or memorial record.',
  90
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

UPDATE burials
SET
  interment_type_id = (SELECT id FROM burial_interment_types WHERE code = 'unknown'),
  review_notes = concat_ws(
    ' ',
    NULLIF(review_notes, ''),
    'Interment type normalized to unknown because this is a pre-need inscription and no interment is asserted.'
  ),
  updated_at = now()
WHERE deleted_at IS NULL
  AND lower(trim(COALESCE(full_name, ''))) = 'terry m eckendahl'
  AND burial_record_status_type_id = (
    SELECT id FROM burial_record_status_types WHERE code = 'pre_need_inscription'
  );

--rollback UPDATE burials SET interment_type_id = (SELECT id FROM burial_interment_types WHERE code = 'casket'), updated_at = now() WHERE deleted_at IS NULL AND lower(trim(COALESCE(full_name, ''))) = 'terry m eckendahl' AND burial_record_status_type_id = (SELECT id FROM burial_record_status_types WHERE code = 'pre_need_inscription');
--rollback DELETE FROM burial_interment_types WHERE code = 'unknown';
