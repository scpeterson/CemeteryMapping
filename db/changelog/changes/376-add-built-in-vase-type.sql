--liquibase formatted sql

--changeset cemeterymapping:376-add-built-in-vase-type splitStatements:false
INSERT INTO headstone_vase_types (code, label, description, sort_order, is_active)
VALUES ('built_in', 'Built-in / integral vase',
  'A flower receptacle formed directly into the marker or its base, rather than a separately manufactured vase attached to it.',
  55, true)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order, is_active = true, updated_at = now();

-- Do not overwrite a conflicting classification entered since this was prepared.
SELECT assert_migration_prerequisite(
  NOT EXISTS (
    SELECT 1 FROM headstones h WHERE h.headstone_id = 'TLC-HS-0576' AND h.deleted_at IS NULL
      AND (
        (h.vase_type_id IS NOT NULL AND h.vase_type_id IS DISTINCT FROM
          (SELECT id FROM headstone_vase_types WHERE code = 'built_in'))
        OR (h.vase_material_type_id IS NOT NULL AND h.vase_material_type_id IS DISTINCT FROM
          (SELECT id FROM headstone_vase_material_types WHERE code = 'granite'))
        OR (h.vase_placement_type_id IS NOT NULL AND h.vase_placement_type_id IS DISTINCT FROM
          (SELECT id FROM headstone_vase_placement_types WHERE code = 'attached_to_marker'))
      )
  ), 'TLC-HS-0576 must not have a conflicting vase classification'
);

UPDATE headstones
SET vase_type_id = (SELECT id FROM headstone_vase_types WHERE code = 'built_in'),
    vase_material_type_id = (SELECT id FROM headstone_vase_material_types WHERE code = 'granite'),
    vase_placement_type_id = (SELECT id FROM headstone_vase_placement_types WHERE code = 'attached_to_marker'),
    vase_notes = CASE
      WHEN position('Flower receptacle formed directly into the marker stone.' IN COALESCE(vase_notes, '')) > 0
        THEN vase_notes
      ELSE concat_ws(E'\n', NULLIF(vase_notes, ''),
        'Flower receptacle formed directly into the marker stone. Confirmed by user and field photos IMG_6211.HEIC and IMG_6212.HEIC; any removable insert is unverified.')
    END,
    updated_at = now()
WHERE headstone_id = 'TLC-HS-0576' AND deleted_at IS NULL;

-- Preserve field classification and referenced lookup data; reversal needs a reviewed correction.
--rollback empty
