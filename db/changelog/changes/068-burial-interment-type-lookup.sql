--liquibase formatted sql

--changeset cemeterymapping:068-burial-interment-type-lookup splitStatements:false
CREATE TABLE IF NOT EXISTS burial_interment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO burial_interment_types (code, label, description, sort_order)
VALUES
  ('casket', 'Casket', 'Traditional casket interment.', 10),
  ('urn', 'Funeral urn', 'Cremated remains interred in a funeral urn.', 20)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS interment_type_id uuid REFERENCES burial_interment_types(id);

UPDATE burials
SET interment_type_id = burial_interment_types.id
FROM burial_interment_types
WHERE burials.interment_type_id IS NULL
  AND burial_interment_types.code = CASE
    WHEN lower(btrim(COALESCE(burials.interment_type, ''))) IN ('urn', 'funeral urn', 'cremation', 'cremated remains') THEN 'urn'
    ELSE 'casket'
  END;

ALTER TABLE burials
  ALTER COLUMN interment_type_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS burials_interment_type_id_idx
  ON burials (interment_type_id);

CREATE OR REPLACE FUNCTION cemetery_section_g_burial_capacity_violation(p_gravesite_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH active_burials AS (
    SELECT COALESCE(burial_interment_types.code, 'casket') AS interment_type
    FROM burials
    LEFT JOIN burial_interment_types
      ON burial_interment_types.id = burials.interment_type_id
    WHERE burials.gravesite_uuid = p_gravesite_uuid
      AND burials.deleted_at IS NULL
  ),
  burial_counts AS (
    SELECT
      count(*) FILTER (WHERE interment_type = 'urn') AS urn_count,
      count(*) FILTER (WHERE interment_type <> 'urn') AS casket_count
    FROM active_burials
  )
  SELECT EXISTS (
    SELECT 1
    FROM burial_counts
    WHERE casket_count > 1
       OR (casket_count = 1 AND urn_count > 0)
       OR urn_count > 2
  )
$$;

DROP TRIGGER IF EXISTS enforce_burial_section_rules ON burials;
CREATE TRIGGER enforce_burial_section_rules
  AFTER INSERT OR UPDATE OF gravesite_uuid, interment_type_id, deleted_at ON burials
  FOR EACH ROW EXECUTE FUNCTION enforce_burial_section_rules();

DROP TRIGGER IF EXISTS touch_burial_interment_types_updated_at ON burial_interment_types;
CREATE TRIGGER touch_burial_interment_types_updated_at
  BEFORE UPDATE ON burial_interment_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_burial_interment_types_changes ON burial_interment_types;
CREATE TRIGGER audit_burial_interment_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON burial_interment_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

ALTER TABLE burials
  DROP COLUMN IF EXISTS interment_type;

--rollback ALTER TABLE burials ADD COLUMN IF NOT EXISTS interment_type text;
--rollback UPDATE burials SET interment_type = burial_interment_types.code FROM burial_interment_types WHERE burial_interment_types.id = burials.interment_type_id;
--rollback CREATE OR REPLACE FUNCTION cemetery_section_g_burial_capacity_violation(p_gravesite_uuid uuid) RETURNS boolean LANGUAGE sql STABLE AS 'WITH active_burials AS (SELECT COALESCE(NULLIF(btrim(interment_type), ''''), ''casket'') AS interment_type FROM burials WHERE gravesite_uuid = p_gravesite_uuid AND deleted_at IS NULL), burial_counts AS (SELECT count(*) FILTER (WHERE interment_type = ''urn'') AS urn_count, count(*) FILTER (WHERE interment_type <> ''urn'') AS casket_count FROM active_burials) SELECT EXISTS (SELECT 1 FROM burial_counts WHERE casket_count > 1 OR (casket_count = 1 AND urn_count > 0) OR urn_count > 2)';
--rollback DROP TRIGGER IF EXISTS enforce_burial_section_rules ON burials;
--rollback CREATE TRIGGER enforce_burial_section_rules AFTER INSERT OR UPDATE OF gravesite_uuid, interment_type, deleted_at ON burials FOR EACH ROW EXECUTE FUNCTION enforce_burial_section_rules();
--rollback DROP TRIGGER IF EXISTS audit_burial_interment_types_changes ON burial_interment_types;
--rollback DROP TRIGGER IF EXISTS touch_burial_interment_types_updated_at ON burial_interment_types;
--rollback DROP INDEX IF EXISTS burials_interment_type_id_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS interment_type_id;
--rollback DROP TABLE IF EXISTS burial_interment_types;
