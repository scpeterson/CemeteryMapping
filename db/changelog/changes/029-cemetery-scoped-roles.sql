--liquibase formatted sql

--changeset cemeterymapping:029-cemetery-scoped-roles
INSERT INTO app_roles (role_name, description)
VALUES
  ('cemetery-admin', 'Can administer assigned cemeteries and has read-only access to other cemeteries.')
ON CONFLICT (role_name) DO UPDATE SET
  description = EXCLUDED.description;

UPDATE app_roles
SET description = 'Can view cemetery records, view and edit deed/owner information for assigned cemeteries, and has read-only access to other cemeteries.'
WHERE role_name = 'power-user';

UPDATE app_roles
SET description = 'Can manage users and roles, view and edit all cemetery records, add structural records, and soft-delete records across the whole system.'
WHERE role_name = 'admin';

CREATE TABLE app_user_cemetery_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE,
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_cemetery_access_unique UNIQUE (app_user_id, cemetery_id)
);

CREATE INDEX app_user_cemetery_access_user_idx ON app_user_cemetery_access (app_user_id);
CREATE INDEX app_user_cemetery_access_cemetery_idx ON app_user_cemetery_access (cemetery_id);

DROP TRIGGER IF EXISTS touch_app_user_cemetery_access_updated_at ON app_user_cemetery_access;
CREATE TRIGGER touch_app_user_cemetery_access_updated_at
  BEFORE UPDATE ON app_user_cemetery_access
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_app_user_cemetery_access_changes ON app_user_cemetery_access;
CREATE TRIGGER audit_app_user_cemetery_access_changes
  AFTER INSERT OR UPDATE OR DELETE ON app_user_cemetery_access
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_app_user_cemetery_access_changes ON app_user_cemetery_access;
--rollback DROP TRIGGER IF EXISTS touch_app_user_cemetery_access_updated_at ON app_user_cemetery_access;
--rollback DROP INDEX IF EXISTS app_user_cemetery_access_cemetery_idx;
--rollback DROP INDEX IF EXISTS app_user_cemetery_access_user_idx;
--rollback DROP TABLE IF EXISTS app_user_cemetery_access;
--rollback ALTER TABLE app_roles DISABLE TRIGGER audit_app_roles_changes;
--rollback UPDATE app_roles SET description = 'Can view cemetery records, view and edit deed/owner information, and update existing cemetery records.' WHERE role_name = 'power-user';
--rollback UPDATE app_roles SET description = 'Can manage users and roles, view and edit all cemetery records, add structural records, and soft-delete records.' WHERE role_name = 'admin';
--rollback DELETE FROM app_roles WHERE role_name = 'cemetery-admin';
--rollback ALTER TABLE app_roles ENABLE TRIGGER audit_app_roles_changes;
