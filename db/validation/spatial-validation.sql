WITH normalized_issues AS (
  SELECT
    CASE
      WHEN scope = 'production'
        AND table_name = 'gravesites'
        AND issue_code = 'overlapping_gravesite'
        AND gravesite_id LIKE 'TLC-GPS-%'
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
