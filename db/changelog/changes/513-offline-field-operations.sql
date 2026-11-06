--liquibase formatted sql

--changeset cemeterymapping:513-offline-field-operations
CREATE TABLE field_operations (
  actor_subject varchar(300) NOT NULL,
  operation_id uuid NOT NULL,
  actor_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  request_hash char(64) NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_subject,operation_id)
);
COMMENT ON TABLE field_operations IS 'Private receipts for explicit field synchronization and photo retries; never authorizes a mutation.';

--rollback DROP TABLE field_operations;
