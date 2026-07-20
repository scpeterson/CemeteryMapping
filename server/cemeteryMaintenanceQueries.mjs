export const maintenanceRecordSelectSql = `
  maintenance_records.id::text,
  maintenance_records.cemetery_id::text,
  maintenance_records.gravesite_uuid::text,
  maintenance_records.headstone_uuid::text,
  maintenance_issue_types.id::text AS issue_type_id,
  maintenance_issue_types.code AS issue_type_code,
  maintenance_issue_types.label AS issue_type_label,
  maintenance_action_types.id::text AS action_type_id,
  maintenance_action_types.code AS action_type_code,
  maintenance_action_types.label AS action_type_label,
  maintenance_priority_types.id::text AS priority_id,
  maintenance_priority_types.code AS priority_code,
  maintenance_priority_types.label AS priority_label,
  maintenance_records.status,
  maintenance_records.observed_at,
  maintenance_records.completed_at,
  maintenance_records.performed_by,
  maintenance_records.source_type,
  maintenance_records.notes
`;

export const maintenanceRecordJoinSql = `
  LEFT JOIN maintenance_issue_types ON maintenance_issue_types.id = maintenance_records.issue_type_id
  LEFT JOIN maintenance_action_types ON maintenance_action_types.id = maintenance_records.action_type_id
  JOIN maintenance_priority_types ON maintenance_priority_types.id = maintenance_records.priority_type_id
`;

export async function maintenanceTablesExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'maintenance_records'
    ) AS exists
  `);
  return Boolean(result.rows[0]?.exists);
}

const maintenanceOrderSql = `
  CASE maintenance_records.status
    WHEN 'open' THEN 1 WHEN 'scheduled' THEN 2 WHEN 'deferred' THEN 3 WHEN 'completed' THEN 4 ELSE 5
  END,
  maintenance_records.observed_at DESC,
  maintenance_records.created_at DESC
`;

export async function selectMaintenanceForGrave(client, graveUuid) {
  if (!(await maintenanceTablesExist(client))) return [];
  const result = await client.query(
    `SELECT ${maintenanceRecordSelectSql}
     FROM maintenance_records ${maintenanceRecordJoinSql}
     WHERE maintenance_records.deleted_at IS NULL AND maintenance_records.gravesite_uuid = $1
     ORDER BY ${maintenanceOrderSql}`,
    [graveUuid],
  );
  return result.rows;
}

export async function selectMaintenanceForHeadstones(client, headstoneUuids) {
  if (!headstoneUuids.length || !(await maintenanceTablesExist(client))) return new Map();
  const result = await client.query(
    `SELECT ${maintenanceRecordSelectSql}
     FROM maintenance_records ${maintenanceRecordJoinSql}
     WHERE maintenance_records.deleted_at IS NULL AND maintenance_records.headstone_uuid = ANY($1::uuid[])
     ORDER BY ${maintenanceOrderSql}`,
    [headstoneUuids],
  );
  const byHeadstone = new Map();
  for (const row of result.rows) {
    const records = byHeadstone.get(row.headstone_uuid) ?? [];
    records.push(row);
    byHeadstone.set(row.headstone_uuid, records);
  }
  return byHeadstone;
}
