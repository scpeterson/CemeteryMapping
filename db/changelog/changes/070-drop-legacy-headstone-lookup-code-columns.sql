--liquibase formatted sql

--changeset cemeterymapping:070-drop-legacy-headstone-lookup-code-columns splitStatements:false
UPDATE headstones
SET marker_type_id = marker_types.id
FROM marker_types
WHERE headstones.marker_type_id IS NULL
  AND marker_types.code = COALESCE(NULLIF(headstones.marker_type_code, ''), 'unknown');

UPDATE headstones
SET material_type_id = marker_material_types.id
FROM marker_material_types
WHERE headstones.material_type_id IS NULL
  AND marker_material_types.code = COALESCE(NULLIF(headstones.material_type_code, ''), 'unknown');

UPDATE headstones
SET condition_type_id = headstone_condition_types.id
FROM headstone_condition_types
WHERE headstones.condition_type_id IS NULL
  AND headstone_condition_types.code = COALESCE(NULLIF(headstones.condition, ''), 'unknown');

CREATE OR REPLACE FUNCTION sync_headstone_lookup_reference_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.marker_type_id IS NULL THEN
    SELECT id INTO NEW.marker_type_id
    FROM marker_types
    WHERE code = 'unknown';
  END IF;

  IF NEW.material_type_id IS NULL THEN
    SELECT id INTO NEW.material_type_id
    FROM marker_material_types
    WHERE code = 'unknown';
  END IF;

  IF NEW.condition_type_id IS NULL THEN
    SELECT id INTO NEW.condition_type_id
    FROM headstone_condition_types
    WHERE code = 'unknown';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION cemetery_marker_type_code(p_marker_type_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT marker_types.code
  FROM marker_types
  WHERE marker_types.id = p_marker_type_id
$$;

CREATE OR REPLACE FUNCTION enforce_headstone_marker_section_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  marker_code text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  marker_code := cemetery_marker_type_code(NEW.marker_type_id);

  IF NEW.gravesite_uuid IS NOT NULL
    AND upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '')) = 'G'
    AND marker_code <> 'flat_marker' THEN
    RAISE EXCEPTION 'Section G can contain only flat markers.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM headstone_gravesites
    JOIN gravesites
      ON gravesites.id = headstone_gravesites.gravesite_uuid
    LEFT JOIN sections
      ON sections.section_id = gravesites.section_uuid
    WHERE headstone_gravesites.deleted_at IS NULL
      AND gravesites.deleted_at IS NULL
      AND headstone_gravesites.headstone_uuid = NEW.id
      AND upper(COALESCE(sections.name, gravesites.section_id, '')) = 'G'
      AND marker_code <> 'flat_marker'
  ) THEN
    RAISE EXCEPTION 'Section G can contain only flat markers.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_headstone_lookup_reference_ids ON headstones;
CREATE TRIGGER sync_headstone_lookup_reference_ids
  BEFORE INSERT OR UPDATE OF marker_type_id, material_type_id, condition_type_id ON headstones
  FOR EACH ROW EXECUTE FUNCTION sync_headstone_lookup_reference_ids();

DROP TRIGGER IF EXISTS enforce_headstone_marker_section_rules ON headstones;
CREATE TRIGGER enforce_headstone_marker_section_rules
  BEFORE INSERT OR UPDATE OF marker_type_id, gravesite_uuid, deleted_at ON headstones
  FOR EACH ROW EXECUTE FUNCTION enforce_headstone_marker_section_rules();

ALTER TABLE headstones
  DROP CONSTRAINT IF EXISTS headstones_marker_type_code_fk,
  DROP CONSTRAINT IF EXISTS headstones_material_type_code_fk,
  DROP CONSTRAINT IF EXISTS headstones_condition_code_fk,
  DROP CONSTRAINT IF EXISTS headstones_marker_type_code_fkey,
  DROP CONSTRAINT IF EXISTS headstones_material_type_code_fkey,
  DROP CONSTRAINT IF EXISTS headstones_condition_fk;

DROP INDEX IF EXISTS headstones_marker_type_code_idx;
DROP INDEX IF EXISTS headstones_material_type_code_idx;
DROP INDEX IF EXISTS headstones_condition_idx;

ALTER TABLE headstones
  DROP COLUMN IF EXISTS marker_type_code,
  DROP COLUMN IF EXISTS material_type_code,
  DROP COLUMN IF EXISTS condition;

--rollback ALTER TABLE headstones ADD COLUMN IF NOT EXISTS marker_type_code varchar(50), ADD COLUMN IF NOT EXISTS material_type_code varchar(50), ADD COLUMN IF NOT EXISTS condition varchar(50);
--rollback UPDATE headstones SET marker_type_code = marker_types.code FROM marker_types WHERE marker_types.id = headstones.marker_type_id;
--rollback UPDATE headstones SET material_type_code = marker_material_types.code FROM marker_material_types WHERE marker_material_types.id = headstones.material_type_id;
--rollback UPDATE headstones SET condition = headstone_condition_types.code FROM headstone_condition_types WHERE headstone_condition_types.id = headstones.condition_type_id;
--rollback UPDATE headstones SET marker_type_code = 'unknown' WHERE marker_type_code IS NULL OR btrim(marker_type_code) = '';
--rollback UPDATE headstones SET material_type_code = 'unknown' WHERE material_type_code IS NULL OR btrim(material_type_code) = '';
--rollback UPDATE headstones SET condition = 'unknown' WHERE condition IS NULL OR btrim(condition) = '';
--rollback ALTER TABLE headstones ALTER COLUMN marker_type_code SET DEFAULT 'unknown', ALTER COLUMN material_type_code SET DEFAULT 'unknown', ALTER COLUMN condition SET DEFAULT 'unknown', ALTER COLUMN marker_type_code SET NOT NULL, ALTER COLUMN material_type_code SET NOT NULL, ALTER COLUMN condition SET NOT NULL;
--rollback ALTER TABLE headstones ADD CONSTRAINT headstones_marker_type_code_fk FOREIGN KEY (marker_type_code) REFERENCES marker_types(code), ADD CONSTRAINT headstones_material_type_code_fk FOREIGN KEY (material_type_code) REFERENCES marker_material_types(code), ADD CONSTRAINT headstones_condition_code_fk FOREIGN KEY (condition) REFERENCES headstone_condition_types(code);
--rollback CREATE INDEX IF NOT EXISTS headstones_marker_type_code_idx ON headstones (marker_type_code);
--rollback CREATE INDEX IF NOT EXISTS headstones_material_type_code_idx ON headstones (material_type_code);
--rollback CREATE INDEX IF NOT EXISTS headstones_condition_idx ON headstones (condition);
--rollback CREATE OR REPLACE FUNCTION sync_headstone_lookup_reference_ids() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF NEW.marker_type_id IS NULL THEN SELECT id INTO NEW.marker_type_id FROM marker_types WHERE code = COALESCE(NULLIF(NEW.marker_type_code, ''''), ''unknown''); ELSE SELECT code INTO NEW.marker_type_code FROM marker_types WHERE id = NEW.marker_type_id; END IF; IF NEW.material_type_id IS NULL THEN SELECT id INTO NEW.material_type_id FROM marker_material_types WHERE code = COALESCE(NULLIF(NEW.material_type_code, ''''), ''unknown''); ELSE SELECT code INTO NEW.material_type_code FROM marker_material_types WHERE id = NEW.material_type_id; END IF; IF NEW.condition_type_id IS NULL THEN SELECT id INTO NEW.condition_type_id FROM headstone_condition_types WHERE code = COALESCE(NULLIF(NEW.condition, ''''), ''unknown''); ELSE SELECT code INTO NEW.condition FROM headstone_condition_types WHERE id = NEW.condition_type_id; END IF; RETURN NEW; END;';
--rollback CREATE OR REPLACE FUNCTION cemetery_marker_type_code(p_marker_type_id uuid, p_marker_type_code text) RETURNS text LANGUAGE sql STABLE AS 'SELECT COALESCE((SELECT marker_types.code FROM marker_types WHERE marker_types.id = p_marker_type_id), NULLIF(p_marker_type_code, ''''))';
--rollback CREATE OR REPLACE FUNCTION enforce_headstone_marker_section_rules() RETURNS trigger LANGUAGE plpgsql AS 'DECLARE marker_code text; BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; marker_code := cemetery_marker_type_code(NEW.marker_type_id, NEW.marker_type_code); IF NEW.gravesite_uuid IS NOT NULL AND upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '''')) = ''G'' AND marker_code <> ''flat_marker'' THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; IF EXISTS (SELECT 1 FROM headstone_gravesites JOIN gravesites ON gravesites.id = headstone_gravesites.gravesite_uuid LEFT JOIN sections ON sections.section_id = gravesites.section_uuid WHERE headstone_gravesites.deleted_at IS NULL AND gravesites.deleted_at IS NULL AND headstone_gravesites.headstone_uuid = NEW.id AND upper(COALESCE(sections.name, gravesites.section_id, '''')) = ''G'' AND marker_code <> ''flat_marker'') THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; RETURN NEW; END;';
--rollback DROP TRIGGER IF EXISTS sync_headstone_lookup_reference_ids ON headstones;
--rollback CREATE TRIGGER sync_headstone_lookup_reference_ids BEFORE INSERT OR UPDATE OF marker_type_id, marker_type_code, material_type_id, material_type_code, condition_type_id, condition ON headstones FOR EACH ROW EXECUTE FUNCTION sync_headstone_lookup_reference_ids();
--rollback DROP TRIGGER IF EXISTS enforce_headstone_marker_section_rules ON headstones;
--rollback CREATE TRIGGER enforce_headstone_marker_section_rules BEFORE INSERT OR UPDATE OF marker_type_id, marker_type_code, gravesite_uuid, deleted_at ON headstones FOR EACH ROW EXECUTE FUNCTION enforce_headstone_marker_section_rules();
