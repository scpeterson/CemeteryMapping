--liquibase formatted sql

--changeset cemeterymapping:384-review-a-0021-kaelin-overlaps splitStatements:false
SELECT assert_migration_prerequisite(
  (
    SELECT count(*)
    FROM spatial_validation_issues
    WHERE scope = 'production'
      AND table_name = 'gravesites'
      AND issue_code = 'overlapping_gravesite'
      AND gravesite_id = 'TLC-GPS-0021'
      AND issue_detail IN (
        'Overlaps gravesite TLC-GPS-0004.',
        'Overlaps gravesite TLC-GPS-0004-01.'
      )
  ) IN (0, 2),
  'the A-0004 split must be absent or produce exactly the two reviewed reciprocal A-0021 overlaps'
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
  'Reviewed after the field-confirmed A-0004 Kaelin split. The fixed shared marker and north/south burial order determine the paired grave placement; these reciprocal intersections come from the estimated neighboring A-0021 polygon.',
  'migration-384'
FROM spatial_validation_issues
WHERE scope = 'production'
  AND table_name = 'gravesites'
  AND issue_code = 'overlapping_gravesite'
  AND gravesite_id = 'TLC-GPS-0021'
  AND issue_detail IN (
    'Overlaps gravesite TLC-GPS-0004.',
    'Overlaps gravesite TLC-GPS-0004-01.'
  )
ON CONFLICT (scope, table_name, issue_code, record_identifier, issue_detail) DO UPDATE SET
  reason = EXCLUDED.reason,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = now(),
  expires_at = NULL,
  is_active = true,
  updated_at = now();

--rollback DELETE FROM reviewed_spatial_validation_exceptions WHERE reviewed_by = 'migration-384';
