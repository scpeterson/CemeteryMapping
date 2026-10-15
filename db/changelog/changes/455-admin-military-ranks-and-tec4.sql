--liquibase formatted sql

--changeset cemeterymapping:455-admin-military-ranks-and-tec4 splitStatements:false
SELECT assert_migration_prerequisite(
  EXISTS (SELECT 1 FROM military_branch_types WHERE code='army' AND is_active),
  'active Army military branch must exist'
);

ALTER TABLE military_rank_types ADD COLUMN description text NOT NULL DEFAULT '';
UPDATE military_rank_types SET description = label || ' (' || abbreviation || ').'
WHERE description = '';

INSERT INTO military_rank_types (military_branch_type_id,code,label,abbreviation,pay_grade,rank_group,sort_order,description)
SELECT id,'tec4','Technician Fourth Grade','Tec 4','4th Grade','enlisted',49,
  'Historical US Army technical rank used 1942–1948; also abbreviated T/4. Historical fourth pay grade, not modern E-4. Source: https://en.wikipedia.org/wiki/Technician_fourth_grade'
FROM military_branch_types WHERE code='army'
ON CONFLICT (military_branch_type_id,code) DO UPDATE SET
  label=EXCLUDED.label,abbreviation=EXCLUDED.abbreviation,pay_grade=EXCLUDED.pay_grade,
  rank_group=EXCLUDED.rank_group,description=EXCLUDED.description,is_active=true,updated_at=now();

--rollback DELETE FROM military_rank_types WHERE code='tec4' AND military_branch_type_id=(SELECT id FROM military_branch_types WHERE code='army') AND NOT EXISTS (SELECT 1 FROM burials WHERE military_rank_type_id=military_rank_types.id);
--rollback ALTER TABLE military_rank_types DROP COLUMN description;
