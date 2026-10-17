--liquibase formatted sql

--changeset cemeterymapping:381-review-a-0032-neighbor-overlaps splitStatements:false
--validCheckSum 9:597a4a1eb559a89df38e2aeedf8282cc
SELECT assert_migration_prerequisite(
  (
    SELECT count(*)
    FROM spatial_validation_issues
    WHERE scope = 'production'
      AND table_name = 'gravesites'
      AND issue_code = 'overlapping_gravesite'
      AND (
        (gravesite_id = 'TLC-GPS-0032' AND issue_detail = 'Overlaps gravesite TLC-GPS-0040.')
        OR
        (gravesite_id = 'TLC-GPS-0032-01' AND issue_detail IN (
          'Overlaps gravesite TLC-GPS-0033.',
          'Overlaps gravesite TLC-GPS-0040.'
        ))
      )
  ) IN (0, 3),
  'the A-0032 split must be absent or produce exactly the three reviewed neighboring overlaps'
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
  'Reviewed after the field-confirmed A-0032 Trohaugh split. The fixed shared marker and north/south burial order determine the paired grave placement; these intersections come from estimated neighboring polygons.',
  'migration-381'
FROM spatial_validation_issues
WHERE scope = 'production'
  AND table_name = 'gravesites'
  AND issue_code = 'overlapping_gravesite'
  AND (
    (gravesite_id = 'TLC-GPS-0032' AND issue_detail = 'Overlaps gravesite TLC-GPS-0040.')
    OR
    (gravesite_id = 'TLC-GPS-0032-01' AND issue_detail IN (
      'Overlaps gravesite TLC-GPS-0033.',
      'Overlaps gravesite TLC-GPS-0040.'
    ))
  )
ON CONFLICT (scope, table_name, issue_code, record_identifier, issue_detail) DO UPDATE SET
  reason = EXCLUDED.reason,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = now(),
  expires_at = NULL,
  is_active = true,
  updated_at = now();

--rollback DELETE FROM reviewed_spatial_validation_exceptions WHERE reviewed_by = 'migration-381';
