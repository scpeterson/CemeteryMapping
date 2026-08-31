--liquibase formatted sql

--changeset cemeterymapping:354-add-army-technician-fifth-grade splitStatements:false
SELECT assert_migration_prerequisite(
  EXISTS (
    SELECT 1 FROM military_branch_types
    WHERE code = 'army' AND is_active
  ),
  'active U.S. Army military branch lookup must exist'
);

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
  't5',
  'Technician Fifth Grade',
  'T/5',
  'E-5',
  'enlisted',
  49,
  true,
  now()
FROM military_branch_types
WHERE military_branch_types.code = 'army'
ON CONFLICT (military_branch_type_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  abbreviation = EXCLUDED.abbreviation,
  pay_grade = EXCLUDED.pay_grade,
  rank_group = EXCLUDED.rank_group,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

--rollback DELETE FROM military_rank_types WHERE code = 't5' AND military_branch_type_id = (SELECT id FROM military_branch_types WHERE code = 'army') AND NOT EXISTS (SELECT 1 FROM burials WHERE burials.military_rank_type_id = military_rank_types.id);
