SELECT
  scope,
  table_name,
  facility_id,
  section_id,
  block_id,
  lot_id,
  grave_id,
  gravesite_id,
  issue_code,
  issue_detail
FROM spatial_validation_issues
ORDER BY scope, table_name, issue_code, facility_id, section_id, block_id, lot_id, grave_id, gravesite_id, id;
