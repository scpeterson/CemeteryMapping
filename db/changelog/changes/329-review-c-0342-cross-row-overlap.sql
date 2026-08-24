--liquibase formatted sql

--changeset cemeterymapping:329-review-c-0342-cross-row-overlap splitStatements:false
SELECT assert_migration_prerequisite(
  (
    SELECT count(*)
    FROM spatial_validation_issues
    WHERE scope = 'production'
      AND table_name = 'gravesites'
      AND issue_code = 'overlapping_gravesite'
      AND gravesite_id = 'TLC-GPS-0343'
      AND issue_detail = 'Overlaps gravesite TLC-GPS-0342-01.'
  ) IN (0, 1),
  'the C-0342 split must be absent or produce exactly the one reviewed cross-row overlap'
);

INSERT INTO reviewed_spatial_validation_exceptions (
  scope, table_name, issue_code, record_identifier, issue_detail, reason, reviewed_by
)
SELECT
  scope,
  table_name,
  issue_code,
  gravesite_id,
  issue_detail,
  'Reviewed after the field-confirmed C-0342 Brant split. The fixed shared marker and north/south burial order determine the paired grave placement; this exact intersection comes from the estimated neighboring C-0343 polygon. Moving the pair would create worse same-row conflicts.',
  'migration-329'
FROM spatial_validation_issues
WHERE scope = 'production'
  AND table_name = 'gravesites'
  AND issue_code = 'overlapping_gravesite'
  AND gravesite_id = 'TLC-GPS-0343'
  AND issue_detail = 'Overlaps gravesite TLC-GPS-0342-01.'
ON CONFLICT (scope, table_name, issue_code, record_identifier, issue_detail) DO UPDATE SET
  reason = EXCLUDED.reason,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = now(),
  expires_at = NULL,
  is_active = true,
  updated_at = now();

--rollback DELETE FROM reviewed_spatial_validation_exceptions WHERE reviewed_by = 'migration-329';
