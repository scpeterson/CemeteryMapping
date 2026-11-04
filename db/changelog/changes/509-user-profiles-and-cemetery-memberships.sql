--liquibase formatted sql

--changeset cemeterymapping:509-user-profiles-and-cemetery-memberships
ALTER TABLE app_user_cemetery_access ADD COLUMN role_name varchar(50);
UPDATE app_user_cemetery_access access
SET role_name = CASE WHEN access.can_edit AND users.role_name IN ('power-user', 'cemetery-admin') THEN users.role_name ELSE 'reader' END
FROM app_users users WHERE users.id = access.app_user_id;
ALTER TABLE app_user_cemetery_access ALTER COLUMN role_name SET DEFAULT 'reader', ALTER COLUMN role_name SET NOT NULL;
ALTER TABLE app_user_cemetery_access ADD CONSTRAINT cemetery_membership_role CHECK (role_name IN ('reader', 'power-user', 'cemetery-admin'));
ALTER TABLE app_users ADD COLUMN phone varchar(50), ADD COLUMN organization varchar(250), ADD COLUMN preferred_cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL;
CREATE INDEX audit_events_app_user_activity_idx ON audit_events(actor_app_user_id, occurred_at DESC, id DESC);
CREATE TABLE app_user_activity (
  app_user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  last_active_at timestamptz NOT NULL DEFAULT now()
);

--rollback DROP TABLE app_user_activity;
--rollback DROP INDEX audit_events_app_user_activity_idx;
--rollback ALTER TABLE app_users DROP COLUMN preferred_cemetery_id, DROP COLUMN organization, DROP COLUMN phone;
--rollback UPDATE app_user_cemetery_access access SET can_edit = false FROM app_users users WHERE users.id = access.app_user_id AND access.role_name <> users.role_name;
--rollback ALTER TABLE app_user_cemetery_access DROP COLUMN role_name;
