--liquibase formatted sql

--changeset scpeterson:058-add-red-granite-material splitStatements:false
INSERT INTO marker_material_types (code, label, description, source_notes, source_url, sort_order)
VALUES
  ('red_granite', 'Red granite', 'Red granite stone marker or monument material.', 'Application extension value for more specific granite color/material identification.', NULL, 13)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  source_notes = EXCLUDED.source_notes,
  source_url = EXCLUDED.source_url,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

--rollback ALTER TABLE marker_material_types DISABLE TRIGGER audit_marker_material_types_changes;
--rollback DELETE FROM marker_material_types WHERE code = 'red_granite' AND NOT EXISTS (SELECT 1 FROM headstones WHERE headstones.material_type_code = marker_material_types.code OR headstones.material_type_id = marker_material_types.id);
--rollback ALTER TABLE marker_material_types ENABLE TRIGGER audit_marker_material_types_changes;
