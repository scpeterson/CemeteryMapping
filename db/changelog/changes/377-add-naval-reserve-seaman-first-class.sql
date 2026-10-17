--liquibase formatted sql

--changeset cemeterymapping:377-add-naval-reserve-seaman-first-class splitStatements:false
-- Historical service and rating: https://www.history.navy.mil/research/library/biographical-files/modern-biographical-files-ndl/modern-bios-c/carpenter-francis.html
-- USNR expansion: https://www.history.navy.mil/content/history/nhhc/research/library/online-reading-room/title-list-alphabetically/h/history-convoy-routing-1945.html
SELECT assert_migration_prerequisite(
  EXISTS (SELECT 1 FROM military_branch_types WHERE code = 'navy' AND is_active),
  'active U.S. Navy military branch lookup must exist'
);

INSERT INTO military_branch_types (code, label, description, sort_order)
VALUES (
  'navy_reserve',
  'U.S. Naval Reserve (USNR)',
  'United States Naval Reserve, the reserve component of the U.S. Navy. Historical inscriptions commonly abbreviate this as USNR.',
  31
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

-- Preserve the historical title rather than mapping it to modern Seaman (SN).
-- Leave pay grade unspecified instead of assigning a modern E-grade retrospectively.
INSERT INTO military_rank_types (
  military_branch_type_id, code, label, abbreviation, pay_grade, rank_group, sort_order
)
SELECT id, 's1c', 'Seaman First Class', 'S1/C', NULL, 'enlisted', 29
FROM military_branch_types
WHERE code IN ('navy', 'navy_reserve')
ON CONFLICT (military_branch_type_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  abbreviation = EXCLUDED.abbreviation,
  pay_grade = EXCLUDED.pay_grade,
  rank_group = EXCLUDED.rank_group,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

--rollback DELETE FROM military_rank_types WHERE code = 's1c' AND military_branch_type_id IN (SELECT id FROM military_branch_types WHERE code IN ('navy', 'navy_reserve')) AND NOT EXISTS (SELECT 1 FROM burials WHERE burials.military_rank_type_id = military_rank_types.id);
--rollback DELETE FROM military_branch_types WHERE code = 'navy_reserve' AND NOT EXISTS (SELECT 1 FROM burials WHERE burials.military_branch_type_id = military_branch_types.id) AND NOT EXISTS (SELECT 1 FROM military_rank_types WHERE military_rank_types.military_branch_type_id = military_branch_types.id);
