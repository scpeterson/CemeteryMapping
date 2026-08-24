--liquibase formatted sql

--changeset cemeterymapping:325-review-c-0340-cross-row-overlaps splitStatements:false
SELECT assert_migration_prerequisite(
  (
    SELECT count(*)
    FROM spatial_validation_issues
    WHERE scope = 'production'
      AND table_name = 'gravesites'
      AND issue_code = 'overlapping_gravesite'
      AND (
        (gravesite_id = 'TLC-GPS-0155' AND issue_detail = 'Overlaps gravesite TLC-GPS-0340.')
        OR (gravesite_id = 'TLC-GPS-0340-01' AND issue_detail IN (
          'Overlaps gravesite TLC-GPS-0328-01.',
          'Overlaps gravesite TLC-GPS-0328-02.'
        ))
      )
  ) IN (0, 3),
  'the C-0340 split must be absent or produce exactly the three reviewed cross-row overlaps'
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
  'Reviewed after the field-confirmed C-0340 Knobeloch split. The fixed shared marker and north/south burial order determine the paired grave placement; these exact cross-row intersections come from estimated neighboring grave polygons. Moving the pair would create worse same-row conflicts.',
  'migration-325'
FROM spatial_validation_issues
WHERE scope = 'production'
  AND table_name = 'gravesites'
  AND issue_code = 'overlapping_gravesite'
  AND (
    (gravesite_id = 'TLC-GPS-0155' AND issue_detail = 'Overlaps gravesite TLC-GPS-0340.')
    OR (gravesite_id = 'TLC-GPS-0340-01' AND issue_detail IN (
      'Overlaps gravesite TLC-GPS-0328-01.',
      'Overlaps gravesite TLC-GPS-0328-02.'
    ))
  )
ON CONFLICT (scope, table_name, issue_code, record_identifier, issue_detail) DO UPDATE SET
  reason = EXCLUDED.reason,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = now(),
  expires_at = NULL,
  is_active = true,
  updated_at = now();

--rollback DELETE FROM reviewed_spatial_validation_exceptions WHERE reviewed_by = 'migration-325';
