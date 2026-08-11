WITH normalized_issues AS (
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM reviewed_spatial_validation_exceptions exception
        WHERE exception.scope = spatial_validation_issues.scope
          AND exception.table_name = spatial_validation_issues.table_name
          AND exception.issue_code = spatial_validation_issues.issue_code
          AND exception.record_identifier = spatial_validation_issues.gravesite_id
          AND exception.issue_detail = spatial_validation_issues.issue_detail
          AND exception.is_active
          AND (exception.expires_at IS NULL OR exception.expires_at > now())
      )
        THEN 'warning'
      ELSE severity
    END AS severity,
    scope,
    batch_id,
    table_name,
    id,
    facility_id,
    section_id,
    block_id,
    lot_id,
    grave_id,
    gravesite_id,
    issue_code,
    issue_detail
  FROM spatial_validation_issues
)
SELECT
  severity,
  scope,
  batch_id,
  table_name,
  facility_id,
  section_id,
  block_id,
  lot_id,
  grave_id,
  gravesite_id,
  issue_code,
  issue_detail
FROM normalized_issues
ORDER BY severity, scope, table_name, issue_code, facility_id, section_id, block_id, lot_id, grave_id, gravesite_id, id;
