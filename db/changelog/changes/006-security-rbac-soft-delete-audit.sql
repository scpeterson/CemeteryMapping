--liquibase formatted sql

--changeset scpeterson:006-security-rbac-soft-delete-audit splitStatements:false
CREATE TABLE app_roles (
  role_name varchar(50) PRIMARY KEY,
  description varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_roles (role_name, description)
VALUES
  ('admin', 'Can view, create, update, and soft-delete cemetery data.'),
  ('reader', 'Can view cemetery data but cannot create, update, or delete it.');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject varchar(300) NOT NULL,
  email varchar(320) NOT NULL,
  display_name varchar(250),
  role_name varchar(50) NOT NULL REFERENCES app_roles(role_name),
  is_active boolean NOT NULL DEFAULT true,
  last_authenticated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_external_subject_unique UNIQUE (external_subject),
  CONSTRAINT app_users_email_unique UNIQUE (email)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  actor_external_subject varchar(300),
  actor_email varchar(320),
  actor_role varchar(50),
  action varchar(50) NOT NULL,
  target_table varchar(100) NOT NULL,
  target_record_id varchar(100),
  previous_values jsonb,
  new_values jsonb,
  reason varchar(1000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_action_check CHECK (
    action IN ('create', 'update', 'soft_delete', 'restore', 'import_promote')
  )
);

ALTER TABLE cemeteries
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE sections
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE blocks
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE lots
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE gravesites
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE burials
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE owners
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE memorials
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE headstones
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

ALTER TABLE headstone_burials
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN delete_reason varchar(1000);

CREATE INDEX app_users_role_name_idx ON app_users (role_name);
CREATE INDEX app_users_active_role_idx ON app_users (is_active, role_name);
CREATE INDEX audit_events_actor_user_idx ON audit_events (actor_user_id, created_at DESC);
CREATE INDEX audit_events_target_idx ON audit_events (target_table, target_record_id, created_at DESC);
CREATE INDEX audit_events_action_created_idx ON audit_events (action, created_at DESC);

CREATE INDEX cemeteries_not_deleted_idx ON cemeteries (id) WHERE deleted_at IS NULL;
CREATE INDEX sections_not_deleted_idx ON sections (id) WHERE deleted_at IS NULL;
CREATE INDEX blocks_not_deleted_idx ON blocks (id) WHERE deleted_at IS NULL;
CREATE INDEX lots_not_deleted_idx ON lots (id) WHERE deleted_at IS NULL;
CREATE INDEX gravesites_not_deleted_idx ON gravesites (id) WHERE deleted_at IS NULL;
CREATE INDEX burials_not_deleted_idx ON burials (id) WHERE deleted_at IS NULL;
CREATE INDEX owners_not_deleted_idx ON owners (id) WHERE deleted_at IS NULL;
CREATE INDEX memorials_not_deleted_idx ON memorials (id) WHERE deleted_at IS NULL;
CREATE INDEX headstones_not_deleted_idx ON headstones (id) WHERE deleted_at IS NULL;
CREATE INDEX headstone_burials_not_deleted_idx
  ON headstone_burials (headstone_uuid, burial_uuid)
  WHERE deleted_at IS NULL;

--rollback DROP INDEX IF EXISTS headstone_burials_not_deleted_idx;
--rollback DROP INDEX IF EXISTS headstones_not_deleted_idx;
--rollback DROP INDEX IF EXISTS memorials_not_deleted_idx;
--rollback DROP INDEX IF EXISTS owners_not_deleted_idx;
--rollback DROP INDEX IF EXISTS burials_not_deleted_idx;
--rollback DROP INDEX IF EXISTS gravesites_not_deleted_idx;
--rollback DROP INDEX IF EXISTS lots_not_deleted_idx;
--rollback DROP INDEX IF EXISTS blocks_not_deleted_idx;
--rollback DROP INDEX IF EXISTS sections_not_deleted_idx;
--rollback DROP INDEX IF EXISTS cemeteries_not_deleted_idx;
--rollback DROP INDEX IF EXISTS audit_events_action_created_idx;
--rollback DROP INDEX IF EXISTS audit_events_target_idx;
--rollback DROP INDEX IF EXISTS audit_events_actor_user_idx;
--rollback DROP INDEX IF EXISTS app_users_active_role_idx;
--rollback DROP INDEX IF EXISTS app_users_role_name_idx;
--rollback ALTER TABLE headstone_burials DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE headstones DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE memorials DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE owners DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE gravesites DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE lots DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE blocks DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE sections DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback ALTER TABLE cemeteries DROP COLUMN IF EXISTS delete_reason, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
--rollback DROP TABLE IF EXISTS audit_events;
--rollback DROP TABLE IF EXISTS app_users;
--rollback DROP TABLE IF EXISTS app_roles;
