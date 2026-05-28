--liquibase formatted sql

--changeset cemeterymapping:011-power-user-role
INSERT INTO app_roles (role_name, description)
VALUES
  ('power-user', 'Can view cemetery records, view and edit deed/owner information, and update existing cemetery records.')
ON CONFLICT (role_name) DO UPDATE SET
  description = EXCLUDED.description;

UPDATE app_roles
SET description = 'Can view the map, gravesites, and burial information, but cannot view deed/owner information.'
WHERE role_name = 'reader';

UPDATE app_roles
SET description = 'Can manage users and roles, view and edit all cemetery records, add structural records, and soft-delete records.'
WHERE role_name = 'admin';

--rollback DELETE FROM app_roles WHERE role_name = 'power-user';
--rollback UPDATE app_roles SET description = 'Can view cemetery data but cannot create, update, or delete it.' WHERE role_name = 'reader';
--rollback UPDATE app_roles SET description = 'Can view, create, update, and soft-delete cemetery data.' WHERE role_name = 'admin';
