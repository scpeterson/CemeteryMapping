--liquibase formatted sql

--changeset cemeterymapping:073-system-event-retention-policy
CREATE TABLE system_event_retention_policies (
  id smallint PRIMARY KEY DEFAULT 1,
  retention_days integer NOT NULL DEFAULT 365,
  minimum_protected_days integer NOT NULL DEFAULT 30,
  batch_size integer NOT NULL DEFAULT 5000,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_event_retention_policies_singleton_check CHECK (id = 1),
  CONSTRAINT system_event_retention_policies_retention_days_check CHECK (retention_days BETWEEN 30 AND 36500),
  CONSTRAINT system_event_retention_policies_minimum_protected_days_check CHECK (minimum_protected_days BETWEEN 30 AND retention_days),
  CONSTRAINT system_event_retention_policies_batch_size_check CHECK (batch_size BETWEEN 1 AND 50000)
);

INSERT INTO system_event_retention_policies (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS touch_system_event_retention_policies_updated_at ON system_event_retention_policies;
CREATE TRIGGER touch_system_event_retention_policies_updated_at
  BEFORE UPDATE ON system_event_retention_policies
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_system_event_retention_policies_changes ON system_event_retention_policies;
CREATE TRIGGER audit_system_event_retention_policies_changes
  AFTER INSERT OR UPDATE OR DELETE ON system_event_retention_policies
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_system_event_retention_policies_changes ON system_event_retention_policies;
--rollback DROP TRIGGER IF EXISTS touch_system_event_retention_policies_updated_at ON system_event_retention_policies;
--rollback DROP TABLE IF EXISTS system_event_retention_policies;
