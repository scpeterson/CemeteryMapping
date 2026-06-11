--liquibase formatted sql

--changeset cemeterymapping:071-audit-retention-policy
CREATE TABLE audit_retention_policies (
  id smallint PRIMARY KEY DEFAULT 1,
  retention_days integer NOT NULL DEFAULT 2555,
  minimum_protected_days integer NOT NULL DEFAULT 365,
  batch_size integer NOT NULL DEFAULT 5000,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_retention_policies_singleton_check CHECK (id = 1),
  CONSTRAINT audit_retention_policies_retention_days_check CHECK (retention_days BETWEEN 365 AND 36500),
  CONSTRAINT audit_retention_policies_minimum_protected_days_check CHECK (minimum_protected_days BETWEEN 365 AND retention_days),
  CONSTRAINT audit_retention_policies_batch_size_check CHECK (batch_size BETWEEN 1 AND 50000)
);

INSERT INTO audit_retention_policies (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX audit_events_occurred_at_idx ON audit_events (occurred_at);

DROP TRIGGER IF EXISTS touch_audit_retention_policies_updated_at ON audit_retention_policies;
CREATE TRIGGER touch_audit_retention_policies_updated_at
  BEFORE UPDATE ON audit_retention_policies
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_audit_retention_policies_changes ON audit_retention_policies;
CREATE TRIGGER audit_audit_retention_policies_changes
  AFTER INSERT OR UPDATE OR DELETE ON audit_retention_policies
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_audit_retention_policies_changes ON audit_retention_policies;
--rollback DROP TRIGGER IF EXISTS touch_audit_retention_policies_updated_at ON audit_retention_policies;
--rollback DROP INDEX IF EXISTS audit_events_occurred_at_idx;
--rollback DROP TABLE IF EXISTS audit_retention_policies;
