--liquibase formatted sql

--changeset scpeterson:057-headstone-design-and-material-details splitStatements:false
ALTER TABLE headstones
  ADD COLUMN design_notes text,
  ADD COLUMN back_description text;

INSERT INTO marker_material_types (code, label, description, source_notes, source_url, sort_order)
VALUES
  ('pink_granite', 'Pink granite', 'Pink granite stone marker or monument material.', 'Application extension value for more specific granite color/material identification.', NULL, 11),
  ('gray_granite', 'Gray granite', 'Gray granite stone marker or monument material.', 'Application extension value for more specific granite color/material identification.', NULL, 12),
  ('white_marble', 'White marble', 'White marble stone marker or monument material.', 'Application extension value for more specific marble color/material identification.', NULL, 21)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  source_notes = EXCLUDED.source_notes,
  source_url = EXCLUDED.source_url,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

--rollback ALTER TABLE marker_material_types DISABLE TRIGGER audit_marker_material_types_changes;
--rollback DELETE FROM marker_material_types WHERE code IN ('pink_granite', 'gray_granite', 'white_marble') AND NOT EXISTS (SELECT 1 FROM headstones WHERE headstones.material_type_code = marker_material_types.code OR headstones.material_type_id = marker_material_types.id);
--rollback ALTER TABLE marker_material_types ENABLE TRIGGER audit_marker_material_types_changes;
--rollback ALTER TABLE headstones DROP COLUMN IF EXISTS back_description, DROP COLUMN IF EXISTS design_notes;
