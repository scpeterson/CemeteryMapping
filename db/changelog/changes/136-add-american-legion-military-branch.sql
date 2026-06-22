--liquibase formatted sql

--changeset cemeterymapping:136-add-american-legion-military-branch
INSERT INTO military_branch_types (code, label, description, sort_order, is_active)
VALUES (
  'american_legion',
  'U.S. American Legion',
  'American Legion veteran organization or marker affiliation recorded as military service context.',
  70,
  true
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

--rollback DELETE FROM military_branch_types WHERE code = 'american_legion';
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'military_branch_types';
