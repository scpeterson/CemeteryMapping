--liquibase formatted sql

--changeset cemeterymapping:307-add-black-granite-material splitStatements:false
INSERT INTO marker_material_types (code, label, description, source_notes, source_url, sort_order)
VALUES (
  'black_granite',
  'Black granite',
  'Black granite stone marker or monument material.',
  'Application extension value for more specific granite color/material identification.',
  NULL,
  14
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  source_notes = EXCLUDED.source_notes,
  source_url = EXCLUDED.source_url,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

--rollback ALTER TABLE marker_material_types DISABLE TRIGGER audit_marker_material_types_changes;
--rollback DELETE FROM marker_material_types WHERE code = 'black_granite' AND NOT EXISTS (SELECT 1 FROM headstones WHERE headstones.material_type_id = marker_material_types.id);
--rollback ALTER TABLE marker_material_types ENABLE TRIGGER audit_marker_material_types_changes;
