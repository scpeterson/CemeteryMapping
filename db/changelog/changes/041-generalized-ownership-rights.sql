--liquibase formatted sql

--changeset cemeterymapping:041-generalized-ownership-rights splitStatements:false
CREATE TABLE ownership_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(250) NOT NULL,
  contact_name varchar(250),
  full_address varchar(250),
  municipality varchar(150),
  state varchar(2),
  zip varchar(10),
  phone varchar(30),
  email varchar(150),
  notes varchar(4000),
  legacy_lot_owner_party_uuid uuid UNIQUE REFERENCES lot_owner_parties(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(4000)
);

CREATE TABLE ownership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  event_type varchar(50) NOT NULL REFERENCES lot_ownership_event_types(code),
  event_type_id uuid REFERENCES lot_ownership_event_types(id),
  effective_date date,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by varchar(150) NOT NULL DEFAULT 'Cemetery database',
  document_reference varchar(250),
  notes varchar(4000),
  source_table varchar(100),
  source_record_id uuid,
  legacy_lot_ownership_event_uuid uuid UNIQUE REFERENCES lot_ownership_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(4000)
);

CREATE TABLE ownership_event_parties (
  ownership_event_uuid uuid NOT NULL REFERENCES ownership_events(id) ON DELETE CASCADE,
  ownership_party_uuid uuid NOT NULL REFERENCES ownership_parties(id) ON DELETE RESTRICT,
  ownership_role varchar(50) NOT NULL DEFAULT 'owner',
  share_numerator integer,
  share_denominator integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ownership_event_uuid, ownership_party_uuid),
  CONSTRAINT ownership_event_parties_share_check CHECK (
    (share_numerator IS NULL AND share_denominator IS NULL)
    OR (share_numerator > 0 AND share_denominator > 0 AND share_numerator <= share_denominator)
  )
);

CREATE TABLE ownership_event_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ownership_event_uuid uuid NOT NULL REFERENCES ownership_events(id) ON DELETE CASCADE,
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  target_type varchar(30) NOT NULL,
  lot_uuid uuid REFERENCES lots(id) ON DELETE SET NULL,
  gravesite_uuid uuid REFERENCES gravesites(id) ON DELETE SET NULL,
  section_uuid uuid REFERENCES sections(section_id) ON DELETE SET NULL,
  unlocated_label varchar(250),
  right_type varchar(50) NOT NULL DEFAULT 'burial_right',
  right_quantity numeric(8, 2),
  notes varchar(4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(4000),
  CONSTRAINT ownership_event_rights_target_type_check CHECK (
    target_type IN ('lot', 'gravesite', 'section', 'unlocated')
  ),
  CONSTRAINT ownership_event_rights_target_check CHECK (
    (
      target_type = 'lot'
      AND lot_uuid IS NOT NULL
      AND gravesite_uuid IS NULL
      AND section_uuid IS NULL
      AND unlocated_label IS NULL
    )
    OR (
      target_type = 'gravesite'
      AND lot_uuid IS NULL
      AND gravesite_uuid IS NOT NULL
      AND section_uuid IS NULL
      AND unlocated_label IS NULL
    )
    OR (
      target_type = 'section'
      AND lot_uuid IS NULL
      AND gravesite_uuid IS NULL
      AND section_uuid IS NOT NULL
      AND unlocated_label IS NULL
    )
    OR (
      target_type = 'unlocated'
      AND lot_uuid IS NULL
      AND gravesite_uuid IS NULL
      AND section_uuid IS NULL
      AND NULLIF(trim(unlocated_label), '') IS NOT NULL
    )
  ),
  CONSTRAINT ownership_event_rights_right_type_check CHECK (
    right_type IN ('burial_right', 'ownership', 'use_right', 'maintenance', 'other')
  ),
  CONSTRAINT ownership_event_rights_quantity_check CHECK (
    right_quantity IS NULL OR right_quantity > 0
  )
);

CREATE INDEX ownership_parties_display_name_trgm_idx
  ON ownership_parties USING gin (lower(display_name) gin_trgm_ops);

CREATE INDEX ownership_events_cemetery_effective_idx
  ON ownership_events (cemetery_id, effective_date DESC NULLS LAST, recorded_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ownership_events_type_idx
  ON ownership_events (event_type);

CREATE INDEX ownership_events_type_id_idx
  ON ownership_events (event_type_id);

CREATE INDEX ownership_event_parties_party_idx
  ON ownership_event_parties (ownership_party_uuid);

CREATE INDEX ownership_event_rights_event_idx
  ON ownership_event_rights (ownership_event_uuid);

CREATE INDEX ownership_event_rights_lot_idx
  ON ownership_event_rights (lot_uuid)
  WHERE target_type = 'lot' AND deleted_at IS NULL;

CREATE INDEX ownership_event_rights_gravesite_idx
  ON ownership_event_rights (gravesite_uuid)
  WHERE target_type = 'gravesite' AND deleted_at IS NULL;

CREATE INDEX ownership_event_rights_section_idx
  ON ownership_event_rights (section_uuid)
  WHERE target_type = 'section' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION sync_ownership_event_type_reference_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_code text;
  resolved_id uuid;
BEGIN
  IF NEW.event_type_id IS NULL THEN
    SELECT id INTO resolved_id
    FROM lot_ownership_event_types
    WHERE code = NEW.event_type;

    NEW.event_type_id := resolved_id;
  ELSE
    SELECT code INTO resolved_code
    FROM lot_ownership_event_types
    WHERE id = NEW.event_type_id;

    IF resolved_code IS NULL THEN
      RAISE EXCEPTION 'Unknown ownership event type id %.', NEW.event_type_id;
    END IF;

    IF NEW.event_type IS NULL THEN
      NEW.event_type := resolved_code;
    ELSIF NEW.event_type <> resolved_code THEN
      RAISE EXCEPTION 'Ownership event type code % does not match type id %.', NEW.event_type, NEW.event_type_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_ownership_event_type_reference_id
  BEFORE INSERT OR UPDATE OF event_type_id, event_type ON ownership_events
  FOR EACH ROW EXECUTE FUNCTION sync_ownership_event_type_reference_id();

CREATE OR REPLACE FUNCTION sync_ownership_event_right_cemetery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  event_cemetery_id uuid;
  target_cemetery_id uuid;
BEGIN
  SELECT cemetery_id INTO event_cemetery_id
  FROM ownership_events
  WHERE id = NEW.ownership_event_uuid;

  IF NEW.target_type = 'lot' THEN
    SELECT cemetery_id INTO target_cemetery_id
    FROM lots
    WHERE id = NEW.lot_uuid;
  ELSIF NEW.target_type = 'gravesite' THEN
    SELECT cemetery_id INTO target_cemetery_id
    FROM gravesites
    WHERE id = NEW.gravesite_uuid;
  ELSIF NEW.target_type = 'section' THEN
    SELECT cemetery_id INTO target_cemetery_id
    FROM sections
    WHERE section_id = NEW.section_uuid;
  ELSE
    target_cemetery_id := event_cemetery_id;
  END IF;

  IF NEW.cemetery_id IS NULL THEN
    NEW.cemetery_id := target_cemetery_id;
  ELSIF target_cemetery_id IS NOT NULL AND NEW.cemetery_id <> target_cemetery_id THEN
    RAISE EXCEPTION 'Ownership right cemetery % does not match target cemetery %.', NEW.cemetery_id, target_cemetery_id;
  END IF;

  IF event_cemetery_id IS NOT NULL AND NEW.cemetery_id IS NOT NULL AND event_cemetery_id <> NEW.cemetery_id THEN
    RAISE EXCEPTION 'Ownership right cemetery % does not match event cemetery %.', NEW.cemetery_id, event_cemetery_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_ownership_event_right_cemetery
  BEFORE INSERT OR UPDATE OF ownership_event_uuid, cemetery_id, target_type, lot_uuid, gravesite_uuid, section_uuid ON ownership_event_rights
  FOR EACH ROW EXECUTE FUNCTION sync_ownership_event_right_cemetery();

CREATE VIEW current_ownership_events AS
SELECT DISTINCT ON (
  ownership_event_rights.cemetery_id,
  ownership_event_rights.target_type,
  ownership_event_rights.lot_uuid,
  ownership_event_rights.gravesite_uuid,
  ownership_event_rights.section_uuid,
  ownership_event_rights.unlocated_label
)
  ownership_events.id,
  ownership_events.cemetery_id,
  ownership_events.event_type,
  ownership_events.event_type_id,
  ownership_events.effective_date,
  ownership_events.recorded_at,
  ownership_events.recorded_by,
  ownership_events.document_reference,
  ownership_events.notes,
  ownership_event_rights.id AS ownership_event_right_uuid,
  ownership_event_rights.target_type,
  ownership_event_rights.lot_uuid,
  ownership_event_rights.gravesite_uuid,
  ownership_event_rights.section_uuid,
  ownership_event_rights.unlocated_label,
  ownership_event_rights.right_type,
  ownership_event_rights.right_quantity,
  ownership_event_rights.notes AS right_notes
FROM ownership_events
JOIN ownership_event_rights
  ON ownership_event_rights.ownership_event_uuid = ownership_events.id
WHERE ownership_events.deleted_at IS NULL
  AND ownership_event_rights.deleted_at IS NULL
ORDER BY
  ownership_event_rights.cemetery_id,
  ownership_event_rights.target_type,
  ownership_event_rights.lot_uuid,
  ownership_event_rights.gravesite_uuid,
  ownership_event_rights.section_uuid,
  ownership_event_rights.unlocated_label,
  ownership_events.effective_date DESC NULLS LAST,
  ownership_events.recorded_at DESC,
  ownership_events.id DESC;

CREATE VIEW current_ownership_right_owners AS
SELECT
  current_ownership_events.ownership_event_right_uuid,
  current_ownership_events.id AS ownership_event_uuid,
  current_ownership_events.cemetery_id,
  current_ownership_events.event_type,
  current_ownership_events.event_type_id,
  current_ownership_events.effective_date,
  current_ownership_events.recorded_at,
  current_ownership_events.target_type,
  current_ownership_events.lot_uuid,
  current_ownership_events.gravesite_uuid,
  current_ownership_events.section_uuid,
  current_ownership_events.unlocated_label,
  current_ownership_events.right_type,
  current_ownership_events.right_quantity,
  ownership_parties.id AS ownership_party_uuid,
  ownership_parties.display_name,
  ownership_event_parties.ownership_role,
  ownership_event_parties.share_numerator,
  ownership_event_parties.share_denominator
FROM current_ownership_events
JOIN ownership_event_parties
  ON ownership_event_parties.ownership_event_uuid = current_ownership_events.id
JOIN ownership_parties
  ON ownership_parties.id = ownership_event_parties.ownership_party_uuid
WHERE current_ownership_events.event_type <> 'release'
  AND ownership_parties.deleted_at IS NULL;

CREATE TRIGGER touch_ownership_parties_updated_at
  BEFORE UPDATE ON ownership_parties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_ownership_events_updated_at
  BEFORE UPDATE ON ownership_events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_ownership_event_rights_updated_at
  BEFORE UPDATE ON ownership_event_rights
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_ownership_parties_changes
  AFTER INSERT OR UPDATE OR DELETE ON ownership_parties
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_ownership_events_changes
  AFTER INSERT OR UPDATE OR DELETE ON ownership_events
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_ownership_event_parties_changes
  AFTER INSERT OR UPDATE OR DELETE ON ownership_event_parties
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('ownership_event_uuid');

CREATE TRIGGER audit_ownership_event_rights_changes
  AFTER INSERT OR UPDATE OR DELETE ON ownership_event_rights
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

INSERT INTO ownership_parties (
  display_name,
  contact_name,
  full_address,
  municipality,
  state,
  zip,
  phone,
  email,
  notes,
  legacy_lot_owner_party_uuid,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  delete_reason
)
SELECT
  display_name,
  contact_name,
  full_address,
  municipality,
  state,
  zip,
  phone,
  email,
  notes,
  id,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  delete_reason
FROM lot_owner_parties
ON CONFLICT (legacy_lot_owner_party_uuid) DO NOTHING;

INSERT INTO ownership_events (
  cemetery_id,
  event_type,
  event_type_id,
  effective_date,
  recorded_at,
  recorded_by,
  document_reference,
  notes,
  source_table,
  source_record_id,
  legacy_lot_ownership_event_uuid,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  delete_reason
)
SELECT
  lots.cemetery_id,
  lot_ownership_events.event_type,
  lot_ownership_events.event_type_id,
  lot_ownership_events.effective_date,
  lot_ownership_events.recorded_at,
  lot_ownership_events.recorded_by,
  lot_ownership_events.document_reference,
  lot_ownership_events.notes,
  'lot_ownership_events',
  lot_ownership_events.id,
  lot_ownership_events.id,
  lot_ownership_events.created_at,
  lot_ownership_events.updated_at,
  lot_ownership_events.deleted_at,
  lot_ownership_events.deleted_by,
  lot_ownership_events.delete_reason
FROM lot_ownership_events
JOIN lots
  ON lots.id = lot_ownership_events.lot_uuid
ON CONFLICT (legacy_lot_ownership_event_uuid) DO NOTHING;

INSERT INTO ownership_event_parties (
  ownership_event_uuid,
  ownership_party_uuid,
  ownership_role,
  share_numerator,
  share_denominator,
  created_at
)
SELECT
  ownership_events.id,
  ownership_parties.id,
  lot_ownership_event_parties.ownership_role,
  lot_ownership_event_parties.share_numerator,
  lot_ownership_event_parties.share_denominator,
  lot_ownership_event_parties.created_at
FROM lot_ownership_event_parties
JOIN ownership_events
  ON ownership_events.legacy_lot_ownership_event_uuid = lot_ownership_event_parties.lot_ownership_event_uuid
JOIN ownership_parties
  ON ownership_parties.legacy_lot_owner_party_uuid = lot_ownership_event_parties.lot_owner_party_uuid
ON CONFLICT (ownership_event_uuid, ownership_party_uuid) DO NOTHING;

INSERT INTO ownership_event_rights (
  ownership_event_uuid,
  cemetery_id,
  target_type,
  lot_uuid,
  right_type,
  right_quantity,
  notes,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  delete_reason
)
SELECT
  ownership_events.id,
  lots.cemetery_id,
  'lot',
  lot_ownership_events.lot_uuid,
  'burial_right',
  NULL,
  lot_ownership_events.notes,
  lot_ownership_events.created_at,
  lot_ownership_events.updated_at,
  lot_ownership_events.deleted_at,
  lot_ownership_events.deleted_by,
  lot_ownership_events.delete_reason
FROM lot_ownership_events
JOIN ownership_events
  ON ownership_events.legacy_lot_ownership_event_uuid = lot_ownership_events.id
JOIN lots
  ON lots.id = lot_ownership_events.lot_uuid
WHERE NOT EXISTS (
  SELECT 1
  FROM ownership_event_rights existing
  WHERE existing.ownership_event_uuid = ownership_events.id
    AND existing.target_type = 'lot'
    AND existing.lot_uuid = lot_ownership_events.lot_uuid
);

--rollback DROP TRIGGER IF EXISTS audit_ownership_event_rights_changes ON ownership_event_rights;
--rollback DROP TRIGGER IF EXISTS audit_ownership_event_parties_changes ON ownership_event_parties;
--rollback DROP TRIGGER IF EXISTS audit_ownership_events_changes ON ownership_events;
--rollback DROP TRIGGER IF EXISTS audit_ownership_parties_changes ON ownership_parties;
--rollback DROP TRIGGER IF EXISTS touch_ownership_event_rights_updated_at ON ownership_event_rights;
--rollback DROP TRIGGER IF EXISTS touch_ownership_events_updated_at ON ownership_events;
--rollback DROP TRIGGER IF EXISTS touch_ownership_parties_updated_at ON ownership_parties;
--rollback DROP VIEW IF EXISTS current_ownership_right_owners;
--rollback DROP VIEW IF EXISTS current_ownership_events;
--rollback DROP TRIGGER IF EXISTS sync_ownership_event_right_cemetery ON ownership_event_rights;
--rollback DROP FUNCTION IF EXISTS sync_ownership_event_right_cemetery();
--rollback DROP TRIGGER IF EXISTS sync_ownership_event_type_reference_id ON ownership_events;
--rollback DROP FUNCTION IF EXISTS sync_ownership_event_type_reference_id();
--rollback DROP INDEX IF EXISTS ownership_event_rights_section_idx;
--rollback DROP INDEX IF EXISTS ownership_event_rights_gravesite_idx;
--rollback DROP INDEX IF EXISTS ownership_event_rights_lot_idx;
--rollback DROP INDEX IF EXISTS ownership_event_rights_event_idx;
--rollback DROP INDEX IF EXISTS ownership_event_parties_party_idx;
--rollback DROP INDEX IF EXISTS ownership_events_type_id_idx;
--rollback DROP INDEX IF EXISTS ownership_events_type_idx;
--rollback DROP INDEX IF EXISTS ownership_events_cemetery_effective_idx;
--rollback DROP INDEX IF EXISTS ownership_parties_display_name_trgm_idx;
--rollback DROP TABLE IF EXISTS ownership_event_rights;
--rollback DROP TABLE IF EXISTS ownership_event_parties;
--rollback DROP TABLE IF EXISTS ownership_events;
--rollback DROP TABLE IF EXISTS ownership_parties;
