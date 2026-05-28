--liquibase formatted sql

--changeset cemeterymapping:026-lookup-surrogate-keys splitStatements:false
ALTER TABLE marker_types ADD COLUMN id uuid DEFAULT gen_random_uuid();
ALTER TABLE marker_material_types ADD COLUMN id uuid DEFAULT gen_random_uuid();
ALTER TABLE headstone_condition_types ADD COLUMN id uuid DEFAULT gen_random_uuid();
ALTER TABLE gravesite_status_types ADD COLUMN id uuid DEFAULT gen_random_uuid();
ALTER TABLE lot_ownership_event_types ADD COLUMN id uuid DEFAULT gen_random_uuid();

UPDATE marker_types SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE marker_material_types SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE headstone_condition_types SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE gravesite_status_types SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE lot_ownership_event_types SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE marker_types ALTER COLUMN id SET NOT NULL;
ALTER TABLE marker_material_types ALTER COLUMN id SET NOT NULL;
ALTER TABLE headstone_condition_types ALTER COLUMN id SET NOT NULL;
ALTER TABLE gravesite_status_types ALTER COLUMN id SET NOT NULL;
ALTER TABLE lot_ownership_event_types ALTER COLUMN id SET NOT NULL;

ALTER TABLE marker_types ADD CONSTRAINT marker_types_code_unique UNIQUE (code);
ALTER TABLE marker_material_types ADD CONSTRAINT marker_material_types_code_unique UNIQUE (code);
ALTER TABLE headstone_condition_types ADD CONSTRAINT headstone_condition_types_code_unique UNIQUE (code);
ALTER TABLE gravesite_status_types ADD CONSTRAINT gravesite_status_types_code_unique UNIQUE (code);
ALTER TABLE lot_ownership_event_types ADD CONSTRAINT lot_ownership_event_types_code_unique UNIQUE (code);

ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_marker_type_code_fkey;
ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_material_type_code_fkey;
ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_condition_fk;
ALTER TABLE gravesites DROP CONSTRAINT IF EXISTS gravesites_status_fk;
ALTER TABLE lot_ownership_events DROP CONSTRAINT IF EXISTS lot_ownership_events_type_fk;

ALTER TABLE marker_types DROP CONSTRAINT marker_types_pkey;
ALTER TABLE marker_material_types DROP CONSTRAINT marker_material_types_pkey;
ALTER TABLE headstone_condition_types DROP CONSTRAINT headstone_condition_types_pkey;
ALTER TABLE gravesite_status_types DROP CONSTRAINT gravesite_status_types_pkey;
ALTER TABLE lot_ownership_event_types DROP CONSTRAINT lot_ownership_event_types_pkey;

ALTER TABLE marker_types ADD CONSTRAINT marker_types_pkey PRIMARY KEY (id);
ALTER TABLE marker_material_types ADD CONSTRAINT marker_material_types_pkey PRIMARY KEY (id);
ALTER TABLE headstone_condition_types ADD CONSTRAINT headstone_condition_types_pkey PRIMARY KEY (id);
ALTER TABLE gravesite_status_types ADD CONSTRAINT gravesite_status_types_pkey PRIMARY KEY (id);
ALTER TABLE lot_ownership_event_types ADD CONSTRAINT lot_ownership_event_types_pkey PRIMARY KEY (id);

ALTER TABLE headstones
  ADD COLUMN marker_type_id uuid,
  ADD COLUMN material_type_id uuid,
  ADD COLUMN condition_type_id uuid;

ALTER TABLE gravesites
  ADD COLUMN status_type_id uuid;

ALTER TABLE lot_ownership_events
  ADD COLUMN event_type_id uuid;

UPDATE headstones
SET marker_type_id = marker_types.id
FROM marker_types
WHERE marker_types.code = headstones.marker_type_code;

UPDATE headstones
SET material_type_id = marker_material_types.id
FROM marker_material_types
WHERE marker_material_types.code = headstones.material_type_code;

UPDATE headstones
SET condition_type_id = headstone_condition_types.id
FROM headstone_condition_types
WHERE headstone_condition_types.code = headstones.condition;

UPDATE gravesites
SET status_type_id = gravesite_status_types.id
FROM gravesite_status_types
WHERE gravesite_status_types.code = gravesites.status;

UPDATE lot_ownership_events
SET event_type_id = lot_ownership_event_types.id
FROM lot_ownership_event_types
WHERE lot_ownership_event_types.code = lot_ownership_events.event_type;

UPDATE headstones
SET marker_type_id = marker_types.id
FROM marker_types
WHERE headstones.marker_type_id IS NULL
  AND marker_types.code = 'unknown';

UPDATE headstones
SET material_type_id = marker_material_types.id
FROM marker_material_types
WHERE headstones.material_type_id IS NULL
  AND marker_material_types.code = 'unknown';

UPDATE headstones
SET condition_type_id = headstone_condition_types.id
FROM headstone_condition_types
WHERE headstones.condition_type_id IS NULL
  AND headstone_condition_types.code = 'unknown';

UPDATE gravesites
SET status_type_id = gravesite_status_types.id
FROM gravesite_status_types
WHERE gravesites.status_type_id IS NULL
  AND gravesite_status_types.code = 'unknown';

CREATE OR REPLACE FUNCTION sync_headstone_lookup_reference_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.marker_type_id IS NULL THEN
    SELECT id INTO NEW.marker_type_id
    FROM marker_types
    WHERE code = COALESCE(NULLIF(NEW.marker_type_code, ''), 'unknown');
  ELSE
    SELECT code INTO NEW.marker_type_code
    FROM marker_types
    WHERE id = NEW.marker_type_id;
  END IF;

  IF NEW.material_type_id IS NULL THEN
    SELECT id INTO NEW.material_type_id
    FROM marker_material_types
    WHERE code = COALESCE(NULLIF(NEW.material_type_code, ''), 'unknown');
  ELSE
    SELECT code INTO NEW.material_type_code
    FROM marker_material_types
    WHERE id = NEW.material_type_id;
  END IF;

  IF NEW.condition_type_id IS NULL THEN
    SELECT id INTO NEW.condition_type_id
    FROM headstone_condition_types
    WHERE code = COALESCE(NULLIF(NEW.condition, ''), 'unknown');
  ELSE
    SELECT code INTO NEW.condition
    FROM headstone_condition_types
    WHERE id = NEW.condition_type_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_gravesite_status_reference_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status_type_id IS NULL THEN
    SELECT id INTO NEW.status_type_id
    FROM gravesite_status_types
    WHERE code = COALESCE(NULLIF(NEW.status, ''), 'unknown');
  ELSE
    SELECT code INTO NEW.status
    FROM gravesite_status_types
    WHERE id = NEW.status_type_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_lot_ownership_event_type_reference_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_type_id IS NULL THEN
    SELECT id INTO NEW.event_type_id
    FROM lot_ownership_event_types
    WHERE code = NEW.event_type;
  ELSE
    SELECT code INTO NEW.event_type
    FROM lot_ownership_event_types
    WHERE id = NEW.event_type_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_headstone_lookup_reference_ids ON headstones;
CREATE TRIGGER sync_headstone_lookup_reference_ids
  BEFORE INSERT OR UPDATE OF marker_type_id, marker_type_code, material_type_id, material_type_code, condition_type_id, condition ON headstones
  FOR EACH ROW EXECUTE FUNCTION sync_headstone_lookup_reference_ids();

DROP TRIGGER IF EXISTS sync_gravesite_status_reference_id ON gravesites;
CREATE TRIGGER sync_gravesite_status_reference_id
  BEFORE INSERT OR UPDATE OF status_type_id, status ON gravesites
  FOR EACH ROW EXECUTE FUNCTION sync_gravesite_status_reference_id();

DROP TRIGGER IF EXISTS sync_lot_ownership_event_type_reference_id ON lot_ownership_events;
CREATE TRIGGER sync_lot_ownership_event_type_reference_id
  BEFORE INSERT OR UPDATE OF event_type_id, event_type ON lot_ownership_events
  FOR EACH ROW EXECUTE FUNCTION sync_lot_ownership_event_type_reference_id();

ALTER TABLE headstones
  ALTER COLUMN marker_type_id SET NOT NULL,
  ALTER COLUMN material_type_id SET NOT NULL,
  ALTER COLUMN condition_type_id SET NOT NULL,
  ADD CONSTRAINT headstones_marker_type_id_fk FOREIGN KEY (marker_type_id) REFERENCES marker_types(id),
  ADD CONSTRAINT headstones_material_type_id_fk FOREIGN KEY (material_type_id) REFERENCES marker_material_types(id),
  ADD CONSTRAINT headstones_condition_type_id_fk FOREIGN KEY (condition_type_id) REFERENCES headstone_condition_types(id),
  ADD CONSTRAINT headstones_marker_type_code_fk FOREIGN KEY (marker_type_code) REFERENCES marker_types(code),
  ADD CONSTRAINT headstones_material_type_code_fk FOREIGN KEY (material_type_code) REFERENCES marker_material_types(code),
  ADD CONSTRAINT headstones_condition_code_fk FOREIGN KEY (condition) REFERENCES headstone_condition_types(code);

ALTER TABLE gravesites
  ALTER COLUMN status_type_id SET NOT NULL,
  ADD CONSTRAINT gravesites_status_type_id_fk FOREIGN KEY (status_type_id) REFERENCES gravesite_status_types(id),
  ADD CONSTRAINT gravesites_status_code_fk FOREIGN KEY (status) REFERENCES gravesite_status_types(code);

ALTER TABLE lot_ownership_events
  ALTER COLUMN event_type_id SET NOT NULL,
  ADD CONSTRAINT lot_ownership_events_type_id_fk FOREIGN KEY (event_type_id) REFERENCES lot_ownership_event_types(id),
  ADD CONSTRAINT lot_ownership_events_type_code_fk FOREIGN KEY (event_type) REFERENCES lot_ownership_event_types(code);

CREATE INDEX headstones_marker_type_id_idx ON headstones (marker_type_id);
CREATE INDEX headstones_material_type_id_idx ON headstones (material_type_id);
CREATE INDEX headstones_condition_type_id_idx ON headstones (condition_type_id);
CREATE INDEX gravesites_status_type_id_idx ON gravesites (status_type_id);
CREATE INDEX lot_ownership_events_type_id_idx ON lot_ownership_events (event_type_id);

DROP TRIGGER IF EXISTS audit_marker_types_changes ON marker_types;
CREATE TRIGGER audit_marker_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON marker_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_marker_material_types_changes ON marker_material_types;
CREATE TRIGGER audit_marker_material_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON marker_material_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_headstone_condition_types_changes ON headstone_condition_types;
CREATE TRIGGER audit_headstone_condition_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_condition_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_gravesite_status_types_changes ON gravesite_status_types;
CREATE TRIGGER audit_gravesite_status_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON gravesite_status_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_lot_ownership_event_types_changes ON lot_ownership_event_types;
CREATE TRIGGER audit_lot_ownership_event_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON lot_ownership_event_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_lot_ownership_event_types_changes ON lot_ownership_event_types;
--rollback DROP TRIGGER IF EXISTS audit_gravesite_status_types_changes ON gravesite_status_types;
--rollback DROP TRIGGER IF EXISTS audit_headstone_condition_types_changes ON headstone_condition_types;
--rollback DROP TRIGGER IF EXISTS audit_marker_material_types_changes ON marker_material_types;
--rollback DROP TRIGGER IF EXISTS audit_marker_types_changes ON marker_types;
--rollback DROP TRIGGER IF EXISTS sync_lot_ownership_event_type_reference_id ON lot_ownership_events;
--rollback DROP TRIGGER IF EXISTS sync_gravesite_status_reference_id ON gravesites;
--rollback DROP TRIGGER IF EXISTS sync_headstone_lookup_reference_ids ON headstones;
--rollback DROP FUNCTION IF EXISTS sync_lot_ownership_event_type_reference_id();
--rollback DROP FUNCTION IF EXISTS sync_gravesite_status_reference_id();
--rollback DROP FUNCTION IF EXISTS sync_headstone_lookup_reference_ids();
--rollback DROP INDEX IF EXISTS lot_ownership_events_type_id_idx;
--rollback DROP INDEX IF EXISTS gravesites_status_type_id_idx;
--rollback DROP INDEX IF EXISTS headstones_condition_type_id_idx;
--rollback DROP INDEX IF EXISTS headstones_material_type_id_idx;
--rollback DROP INDEX IF EXISTS headstones_marker_type_id_idx;
--rollback ALTER TABLE lot_ownership_events DROP CONSTRAINT IF EXISTS lot_ownership_events_type_code_fk, DROP CONSTRAINT IF EXISTS lot_ownership_events_type_id_fk, DROP COLUMN IF EXISTS event_type_id;
--rollback ALTER TABLE gravesites DROP CONSTRAINT IF EXISTS gravesites_status_code_fk, DROP CONSTRAINT IF EXISTS gravesites_status_type_id_fk, DROP COLUMN IF EXISTS status_type_id;
--rollback ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_condition_code_fk, DROP CONSTRAINT IF EXISTS headstones_material_type_code_fk, DROP CONSTRAINT IF EXISTS headstones_marker_type_code_fk, DROP CONSTRAINT IF EXISTS headstones_condition_type_id_fk, DROP CONSTRAINT IF EXISTS headstones_material_type_id_fk, DROP CONSTRAINT IF EXISTS headstones_marker_type_id_fk, DROP COLUMN IF EXISTS condition_type_id, DROP COLUMN IF EXISTS material_type_id, DROP COLUMN IF EXISTS marker_type_id;
--rollback ALTER TABLE lot_ownership_event_types DROP CONSTRAINT IF EXISTS lot_ownership_event_types_pkey, ADD CONSTRAINT lot_ownership_event_types_pkey PRIMARY KEY (code), DROP CONSTRAINT IF EXISTS lot_ownership_event_types_code_unique, DROP COLUMN IF EXISTS id;
--rollback ALTER TABLE gravesite_status_types DROP CONSTRAINT IF EXISTS gravesite_status_types_pkey, ADD CONSTRAINT gravesite_status_types_pkey PRIMARY KEY (code), DROP CONSTRAINT IF EXISTS gravesite_status_types_code_unique, DROP COLUMN IF EXISTS id;
--rollback ALTER TABLE headstone_condition_types DROP CONSTRAINT IF EXISTS headstone_condition_types_pkey, ADD CONSTRAINT headstone_condition_types_pkey PRIMARY KEY (code), DROP CONSTRAINT IF EXISTS headstone_condition_types_code_unique, DROP COLUMN IF EXISTS id;
--rollback ALTER TABLE marker_material_types DROP CONSTRAINT IF EXISTS marker_material_types_pkey, ADD CONSTRAINT marker_material_types_pkey PRIMARY KEY (code), DROP CONSTRAINT IF EXISTS marker_material_types_code_unique, DROP COLUMN IF EXISTS id;
--rollback ALTER TABLE marker_types DROP CONSTRAINT IF EXISTS marker_types_pkey, ADD CONSTRAINT marker_types_pkey PRIMARY KEY (code), DROP CONSTRAINT IF EXISTS marker_types_code_unique, DROP COLUMN IF EXISTS id;
