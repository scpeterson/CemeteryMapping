--liquibase formatted sql

--changeset cemeterymapping:014-database-audit-triggers splitStatements:false
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS actor_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_database_user text NOT NULL DEFAULT current_user,
  ADD COLUMN IF NOT EXISTS actor_session_user text NOT NULL DEFAULT session_user,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS transaction_id bigint NOT NULL DEFAULT txid_current();

UPDATE audit_events
SET occurred_at = created_at
WHERE occurred_at IS DISTINCT FROM created_at;

UPDATE audit_events
SET actor_app_user_id = actor_user_id
WHERE actor_app_user_id IS NULL
  AND actor_user_id IS NOT NULL;

ALTER TABLE audit_events
  DROP CONSTRAINT IF EXISTS audit_events_action_check;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_action_check CHECK (
    action IN ('create', 'update', 'soft_delete', 'restore', 'delete', 'import_promote')
  );

CREATE INDEX IF NOT EXISTS audit_events_database_user_idx ON audit_events (actor_database_user, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_transaction_idx ON audit_events (transaction_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION audit_nullable_setting(setting_name text)
RETURNS text
LANGUAGE sql
AS $$
  SELECT NULLIF(current_setting(setting_name, true), '')
$$;

CREATE OR REPLACE FUNCTION audit_setting_uuid(setting_name text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  setting_value text;
BEGIN
  setting_value := audit_nullable_setting(setting_name);
  IF setting_value IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN setting_value::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION audit_changed_row_values(row_values jsonb, changed_columns text[])
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT COALESCE(jsonb_object_agg(changed_column, row_values -> changed_column), '{}'::jsonb)
  FROM unnest(changed_columns) AS changed_column
$$;

CREATE OR REPLACE FUNCTION audit_record_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  primary_key_column text := COALESCE(TG_ARGV[0], 'id');
  audit_action text;
  old_row jsonb;
  new_row jsonb;
  changed_columns text[] := '{}'::text[];
  audit_old_values jsonb;
  audit_new_values jsonb;
  target_id text;
  audit_reason text;
  audit_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    audit_action := 'create';
    new_row := to_jsonb(NEW);
    audit_new_values := new_row;
    target_id := new_row ->> primary_key_column;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS NOT DISTINCT FROM NEW THEN
      RETURN NEW;
    END IF;

    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);

    SELECT COALESCE(array_agg(column_name ORDER BY column_name), '{}'::text[])
    INTO changed_columns
    FROM (
      SELECT jsonb_object_keys(old_row || new_row) AS column_name
    ) AS columns
    WHERE old_row -> columns.column_name IS DISTINCT FROM new_row -> columns.column_name;

    IF old_row ->> 'deleted_at' IS NULL AND new_row ->> 'deleted_at' IS NOT NULL THEN
      audit_action := 'soft_delete';
    ELSIF old_row ->> 'deleted_at' IS NOT NULL AND new_row ->> 'deleted_at' IS NULL THEN
      audit_action := 'restore';
    ELSE
      audit_action := 'update';
    END IF;

    audit_old_values := audit_changed_row_values(old_row, changed_columns);
    audit_new_values := audit_changed_row_values(new_row, changed_columns);
    target_id := COALESCE(new_row ->> primary_key_column, old_row ->> primary_key_column);
  ELSIF TG_OP = 'DELETE' THEN
    audit_action := 'delete';
    old_row := to_jsonb(OLD);
    audit_old_values := old_row;
    target_id := old_row ->> primary_key_column;
  ELSE
    RETURN NULL;
  END IF;

  audit_reason := COALESCE(audit_nullable_setting('app.audit.reason'), new_row ->> 'delete_reason', old_row ->> 'delete_reason');
  audit_metadata := jsonb_strip_nulls(jsonb_build_object(
    'application_name', audit_nullable_setting('application_name'),
    'client_addr', inet_client_addr()::text,
    'client_port', inet_client_port(),
    'request_id', audit_nullable_setting('app.audit.request_id')
  ));

  INSERT INTO audit_events (
    actor_user_id,
    actor_app_user_id,
    actor_external_subject,
    actor_email,
    actor_role,
    actor_database_user,
    actor_session_user,
    source,
    transaction_id,
    action,
    target_table,
    target_record_id,
    previous_values,
    new_values,
    changed_fields,
    reason,
    metadata,
    occurred_at
  )
  VALUES (
    audit_setting_uuid('app.audit.user_id'),
    audit_setting_uuid('app.audit.user_id'),
    audit_nullable_setting('app.audit.external_subject'),
    audit_nullable_setting('app.audit.email'),
    audit_nullable_setting('app.audit.role'),
    current_user,
    session_user,
    COALESCE(audit_nullable_setting('app.audit.source'), 'database'),
    txid_current(),
    audit_action,
    TG_TABLE_NAME,
    target_id,
    audit_old_values,
    audit_new_values,
    changed_columns,
    audit_reason,
    audit_metadata,
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_cemeteries_changes ON cemeteries;
CREATE TRIGGER audit_cemeteries_changes
  AFTER INSERT OR UPDATE OR DELETE ON cemeteries
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_sections_changes ON sections;
CREATE TRIGGER audit_sections_changes
  AFTER INSERT OR UPDATE OR DELETE ON sections
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('section_id');

DROP TRIGGER IF EXISTS audit_blocks_changes ON blocks;
CREATE TRIGGER audit_blocks_changes
  AFTER INSERT OR UPDATE OR DELETE ON blocks
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_lots_changes ON lots;
CREATE TRIGGER audit_lots_changes
  AFTER INSERT OR UPDATE OR DELETE ON lots
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_gravesites_changes ON gravesites;
CREATE TRIGGER audit_gravesites_changes
  AFTER INSERT OR UPDATE OR DELETE ON gravesites
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_burials_changes ON burials;
CREATE TRIGGER audit_burials_changes
  AFTER INSERT OR UPDATE OR DELETE ON burials
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_owners_changes ON owners;
CREATE TRIGGER audit_owners_changes
  AFTER INSERT OR UPDATE OR DELETE ON owners
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_lot_owner_parties_changes ON lot_owner_parties;
CREATE TRIGGER audit_lot_owner_parties_changes
  AFTER INSERT OR UPDATE OR DELETE ON lot_owner_parties
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_memorials_changes ON memorials;
CREATE TRIGGER audit_memorials_changes
  AFTER INSERT OR UPDATE OR DELETE ON memorials
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_headstones_changes ON headstones;
CREATE TRIGGER audit_headstones_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstones
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_headstone_burials_changes ON headstone_burials;
CREATE TRIGGER audit_headstone_burials_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_burials
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_app_users_changes ON app_users;
CREATE TRIGGER audit_app_users_changes
  AFTER INSERT OR UPDATE OR DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

DROP TRIGGER IF EXISTS audit_app_roles_changes ON app_roles;
CREATE TRIGGER audit_app_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON app_roles
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('role_name');

--rollback DROP TRIGGER IF EXISTS audit_app_roles_changes ON app_roles;
--rollback DROP TRIGGER IF EXISTS audit_app_users_changes ON app_users;
--rollback DROP TRIGGER IF EXISTS audit_headstone_burials_changes ON headstone_burials;
--rollback DROP TRIGGER IF EXISTS audit_headstones_changes ON headstones;
--rollback DROP TRIGGER IF EXISTS audit_memorials_changes ON memorials;
--rollback DROP TRIGGER IF EXISTS audit_lot_owner_parties_changes ON lot_owner_parties;
--rollback DROP TRIGGER IF EXISTS audit_owners_changes ON owners;
--rollback DROP TRIGGER IF EXISTS audit_burials_changes ON burials;
--rollback DROP TRIGGER IF EXISTS audit_gravesites_changes ON gravesites;
--rollback DROP TRIGGER IF EXISTS audit_lots_changes ON lots;
--rollback DROP TRIGGER IF EXISTS audit_blocks_changes ON blocks;
--rollback DROP TRIGGER IF EXISTS audit_sections_changes ON sections;
--rollback DROP TRIGGER IF EXISTS audit_cemeteries_changes ON cemeteries;
--rollback DROP FUNCTION IF EXISTS audit_record_change();
--rollback DROP FUNCTION IF EXISTS audit_changed_row_values(jsonb, text[]);
--rollback DROP FUNCTION IF EXISTS audit_setting_uuid(text);
--rollback DROP FUNCTION IF EXISTS audit_nullable_setting(text);
--rollback DROP INDEX IF EXISTS audit_events_transaction_idx;
--rollback DROP INDEX IF EXISTS audit_events_database_user_idx;
--rollback ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;
--rollback ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN ('create', 'update', 'soft_delete', 'restore', 'import_promote'));
--rollback ALTER TABLE audit_events DROP COLUMN IF EXISTS transaction_id, DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS actor_session_user, DROP COLUMN IF EXISTS actor_database_user, DROP COLUMN IF EXISTS actor_app_user_id, DROP COLUMN IF EXISTS changed_fields, DROP COLUMN IF EXISTS occurred_at;
