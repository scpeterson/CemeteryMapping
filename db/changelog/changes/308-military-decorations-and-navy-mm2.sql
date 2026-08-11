--liquibase formatted sql

--changeset cemeterymapping:308-military-decorations-and-navy-mm2 splitStatements:false
CREATE TABLE military_decoration_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  label varchar(150) NOT NULL,
  description text,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO military_decoration_types (code, label, description, sort_order)
VALUES
  ('purple_heart', 'Purple Heart', 'United States military decoration awarded to service members wounded or killed as a result of enemy action.', 10),
  ('bronze_star_medal', 'Bronze Star Medal', 'United States military decoration for heroic or meritorious achievement or service in a combat zone.', 20)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

CREATE TABLE burial_military_decorations (
  burial_uuid uuid NOT NULL REFERENCES burials(id) ON DELETE CASCADE,
  military_decoration_type_id uuid NOT NULL REFERENCES military_decoration_types(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (burial_uuid, military_decoration_type_id)
);

CREATE INDEX burial_military_decorations_type_idx
  ON burial_military_decorations (military_decoration_type_id, burial_uuid);

INSERT INTO military_rank_types (
  military_branch_type_id,
  code,
  label,
  abbreviation,
  pay_grade,
  rank_group,
  sort_order
)
SELECT
  military_branch_types.id,
  'mm2',
  'Machinist''s Mate Second Class',
  'MM2',
  'E-5',
  'enlisted',
  51
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

DROP TRIGGER IF EXISTS touch_military_decoration_types_updated_at ON military_decoration_types;
CREATE TRIGGER touch_military_decoration_types_updated_at
  BEFORE UPDATE ON military_decoration_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_military_decoration_types_changes ON military_decoration_types;
CREATE TRIGGER audit_military_decoration_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON military_decoration_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_burial_military_decorations_changes ON burial_military_decorations;
CREATE TRIGGER audit_burial_military_decorations_changes
  AFTER INSERT OR UPDATE OR DELETE ON burial_military_decorations
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('burial_uuid');

--rollback DROP TRIGGER IF EXISTS audit_burial_military_decorations_changes ON burial_military_decorations;
--rollback DROP TRIGGER IF EXISTS audit_military_decoration_types_changes ON military_decoration_types;
--rollback DROP TRIGGER IF EXISTS touch_military_decoration_types_updated_at ON military_decoration_types;
--rollback DELETE FROM military_rank_types WHERE code = 'mm2' AND military_branch_type_id = (SELECT id FROM military_branch_types WHERE code = 'navy') AND NOT EXISTS (SELECT 1 FROM burials WHERE burials.military_rank_type_id = military_rank_types.id);
--rollback DROP TABLE IF EXISTS burial_military_decorations;
--rollback DROP TABLE IF EXISTS military_decoration_types;
