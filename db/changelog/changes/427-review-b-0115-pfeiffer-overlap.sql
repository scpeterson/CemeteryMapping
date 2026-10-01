--liquibase formatted sql

--changeset cemeterymapping:427-review-b-0115-pfeiffer-overlap
INSERT INTO reviewed_spatial_validation_exceptions (
  scope, table_name, issue_code, record_identifier, issue_detail, reason, reviewed_by
)
SELECT scope, table_name, issue_code, gravesite_id, issue_detail,
  'User approved marker-centered 4-by-10-foot Pfeiffer gravesites and this specific neighboring overlap on 2026-10-01. See ADR 0082.',
  'migration-427'
FROM spatial_validation_issues
WHERE scope = 'production' AND table_name = 'gravesites' AND issue_code = 'overlapping_gravesite'
  AND ((gravesite_id = 'TLC-GPS-0116' AND issue_detail = 'Overlaps gravesite TLC-GPS-0115-01.')
    OR (gravesite_id = 'TLC-GPS-0115-01' AND issue_detail = 'Overlaps gravesite TLC-GPS-0116.'))
ON CONFLICT (scope, table_name, issue_code, record_identifier, issue_detail) DO UPDATE SET
  reason = EXCLUDED.reason, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now(),
  expires_at = NULL, is_active = true, updated_at = now();

--rollback DELETE FROM reviewed_spatial_validation_exceptions WHERE reviewed_by = 'migration-427';
