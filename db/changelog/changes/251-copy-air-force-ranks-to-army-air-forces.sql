--liquibase formatted sql

--changeset cemeterymapping:251-copy-air-force-ranks-to-army-air-forces
WITH target_branches AS (
  SELECT id
  FROM military_branch_types
  WHERE code IN ('army_air_forces', 'army_air_forces_base_unit')
),
air_force_ranks AS (
  SELECT
    military_rank_types.code,
    military_rank_types.label,
    military_rank_types.abbreviation,
    military_rank_types.pay_grade,
    military_rank_types.rank_group,
    military_rank_types.sort_order,
    military_rank_types.is_active
  FROM military_rank_types
  JOIN military_branch_types
    ON military_branch_types.id = military_rank_types.military_branch_type_id
  WHERE military_branch_types.code = 'air_force'
)
INSERT INTO military_rank_types (
  military_branch_type_id,
  code,
  label,
  abbreviation,
  pay_grade,
  rank_group,
  sort_order,
  is_active
)
SELECT
  target_branches.id,
  air_force_ranks.code,
  air_force_ranks.label,
  air_force_ranks.abbreviation,
  air_force_ranks.pay_grade,
  air_force_ranks.rank_group,
  air_force_ranks.sort_order,
  air_force_ranks.is_active
FROM target_branches
CROSS JOIN air_force_ranks
ON CONFLICT (military_branch_type_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  abbreviation = EXCLUDED.abbreviation,
  pay_grade = EXCLUDED.pay_grade,
  rank_group = EXCLUDED.rank_group,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

--rollback DELETE FROM military_rank_types WHERE military_branch_type_id IN (SELECT id FROM military_branch_types WHERE code IN ('army_air_forces', 'army_air_forces_base_unit'));
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table = 'military_rank_types';
