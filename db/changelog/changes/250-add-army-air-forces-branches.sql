--liquibase formatted sql

--changeset cemeterymapping:250-add-army-air-forces-branches
INSERT INTO military_branch_types (code, label, description, sort_order, is_active)
VALUES
  (
    'army_air_forces',
    'Army Air Forces',
    'United States Army Air Forces, the Army aviation service that operated from 1941 to 1947.',
    11,
    true
  ),
  (
    'army_air_forces_base_unit',
    'Army Air Forces Base Unit',
    'Army Air Forces Base Unit assignment recorded as the military service branch or organization.',
    12,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

--rollback DELETE FROM military_branch_types WHERE code IN ('army_air_forces', 'army_air_forces_base_unit');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'military_branch_types';
