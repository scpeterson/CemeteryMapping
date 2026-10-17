--liquibase formatted sql

--changeset cemeterymapping:407-add-navy-fireman-first-class splitStatements:false
SELECT assert_migration_prerequisite(
  EXISTS (
    SELECT 1 FROM military_branch_types
    WHERE code = 'navy' AND is_active
  ),
  'active U.S. Navy military branch lookup must exist'
);

-- Preserve the historical rate without assigning a modern pay grade.
INSERT INTO military_rank_types (
  military_branch_type_id,
  code,
  label,
  abbreviation,
  pay_grade,
  rank_group,
  sort_order,
  is_active,
  updated_at
)
SELECT
  military_branch_types.id,
  'f1c',
  'Fireman First Class',
  'F1c',
  NULL,
  'enlisted',
  31,
  true,
  now()
FROM military_branch_types
WHERE military_branch_types.code = 'navy'
ON CONFLICT (military_branch_type_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  abbreviation = EXCLUDED.abbreviation,
  pay_grade = EXCLUDED.pay_grade,
  rank_group = EXCLUDED.rank_group,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

--rollback DELETE FROM military_rank_types WHERE code = 'f1c' AND military_branch_type_id = (SELECT id FROM military_branch_types WHERE code = 'navy') AND NOT EXISTS (SELECT 1 FROM burials WHERE burials.military_rank_type_id = military_rank_types.id);
