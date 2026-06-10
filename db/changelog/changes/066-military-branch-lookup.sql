--liquibase formatted sql

--changeset cemeterymapping:066-military-branch-lookup splitStatements:false
CREATE TABLE IF NOT EXISTS military_branch_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO military_branch_types (code, label, description, sort_order)
VALUES
  ('army', 'U.S. Army', 'United States Army.', 10),
  ('marine_corps', 'U.S. Marine Corps', 'United States Marine Corps.', 20),
  ('navy', 'U.S. Navy', 'United States Navy.', 30),
  ('air_force', 'U.S. Air Force', 'United States Air Force.', 40),
  ('space_force', 'U.S. Space Force', 'United States Space Force.', 50),
  ('coast_guard', 'U.S. Coast Guard', 'United States Coast Guard.', 60)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS military_branch_type_id uuid REFERENCES military_branch_types(id);

UPDATE burials
SET military_branch_type_id = military_branch_types.id
FROM military_branch_types
WHERE burials.military_branch_type_id IS NULL
  AND military_branch_types.code = CASE
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('army', 'u.s. army', 'us army', 'united states army') THEN 'army'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('marine corps', 'marines', 'u.s. marine corps', 'us marine corps', 'united states marine corps') THEN 'marine_corps'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('navy', 'u.s. navy', 'us navy', 'united states navy') THEN 'navy'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('air force', 'u.s. air force', 'us air force', 'united states air force') THEN 'air_force'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('space force', 'u.s. space force', 'us space force', 'united states space force') THEN 'space_force'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('coast guard', 'u.s. coast guard', 'us coast guard', 'united states coast guard') THEN 'coast_guard'
    ELSE NULL
  END;

CREATE INDEX IF NOT EXISTS burials_military_branch_type_id_idx
  ON burials (military_branch_type_id);

DROP TRIGGER IF EXISTS touch_military_branch_types_updated_at ON military_branch_types;
CREATE TRIGGER touch_military_branch_types_updated_at
  BEFORE UPDATE ON military_branch_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_military_branch_types_changes ON military_branch_types;
CREATE TRIGGER audit_military_branch_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON military_branch_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_military_branch_types_changes ON military_branch_types;
--rollback DROP TRIGGER IF EXISTS touch_military_branch_types_updated_at ON military_branch_types;
--rollback DROP INDEX IF EXISTS burials_military_branch_type_id_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS military_branch_type_id;
--rollback DROP TABLE IF EXISTS military_branch_types;
