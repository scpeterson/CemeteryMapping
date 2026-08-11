--liquibase formatted sql

--changeset cemeterymapping:313-reviewed-spatial-validation-exceptions splitStatements:false
CREATE TABLE IF NOT EXISTS reviewed_spatial_validation_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope varchar(30) NOT NULL,
  table_name varchar(100) NOT NULL,
  issue_code varchar(100) NOT NULL,
  record_identifier varchar(255) NOT NULL,
  issue_detail text NOT NULL,
  reason text NOT NULL,
  reviewed_by varchar(255) NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviewed_spatial_validation_exceptions_unique
    UNIQUE (scope, table_name, issue_code, record_identifier, issue_detail)
);

CREATE INDEX IF NOT EXISTS reviewed_spatial_validation_exceptions_active_idx
  ON reviewed_spatial_validation_exceptions (
    scope, table_name, issue_code, record_identifier, is_active
  );

INSERT INTO reviewed_spatial_validation_exceptions (
  scope,
  table_name,
  issue_code,
  record_identifier,
  issue_detail,
  reason,
  reviewed_by
)
SELECT
  scope,
  table_name,
  issue_code,
  gravesite_id,
  issue_detail,
  'Migrated from the former blanket Trinity overlap allowance. This exact pre-existing overlap remains a warning pending geometry review; newly introduced overlaps remain errors.',
  'migration-313'
FROM spatial_validation_issues
WHERE scope = 'production'
  AND table_name = 'gravesites'
  AND issue_code = 'overlapping_gravesite'
  AND gravesite_id LIKE 'TLC-GPS-%'
ON CONFLICT (scope, table_name, issue_code, record_identifier, issue_detail) DO NOTHING;

DROP TRIGGER IF EXISTS touch_reviewed_spatial_validation_exceptions_updated_at
  ON reviewed_spatial_validation_exceptions;
CREATE TRIGGER touch_reviewed_spatial_validation_exceptions_updated_at
  BEFORE UPDATE ON reviewed_spatial_validation_exceptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_reviewed_spatial_validation_exceptions_changes
  ON reviewed_spatial_validation_exceptions;
CREATE TRIGGER audit_reviewed_spatial_validation_exceptions_changes
  AFTER INSERT OR UPDATE OR DELETE ON reviewed_spatial_validation_exceptions
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_reviewed_spatial_validation_exceptions_changes ON reviewed_spatial_validation_exceptions;
--rollback DROP TRIGGER IF EXISTS touch_reviewed_spatial_validation_exceptions_updated_at ON reviewed_spatial_validation_exceptions;
--rollback DROP TABLE IF EXISTS reviewed_spatial_validation_exceptions;
