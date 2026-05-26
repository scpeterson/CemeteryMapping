const allowedAuditActions = new Set(["create", "update", "soft_delete", "restore", "delete", "import_promote"]);
const allowedAuditTables = new Set([
  "app_roles",
  "app_users",
  "blocks",
  "burials",
  "cemeteries",
  "deed_registry_entries",
  "deed_registry_entry_allocations",
  "deed_registry_import_batches",
  "gravesites",
  "headstone_burials",
  "headstones",
  "lot_owner_parties",
  "lots",
  "memorials",
  "owners",
  "sections",
]);

function toAuditEvent(row) {
  return {
    id: row.id,
    occurredAt: row.occurred_at?.toISOString?.() ?? row.occurred_at,
    action: row.action,
    targetTable: row.target_table,
    targetRecordId: row.target_record_id ?? "",
    actorEmail: row.actor_email ?? "",
    actorRole: row.actor_role ?? "",
    actorExternalSubject: row.actor_external_subject ?? "",
    actorDatabaseUser: row.actor_database_user ?? "",
    actorSessionUser: row.actor_session_user ?? "",
    source: row.source ?? "",
    reason: row.reason ?? "",
    changedFields: row.changed_fields ?? [],
    previousValues: row.previous_values ?? {},
    newValues: row.new_values ?? {},
    metadata: row.metadata ?? {},
  };
}

function normalizedLimit(limit) {
  const parsed = Number.parseInt(String(limit ?? ""), 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

export function normalizeAuditFilters(filters = {}) {
  const action = String(filters.action ?? "").trim();
  const targetTable = String(filters.targetTable ?? "").trim();
  const actor = String(filters.actor ?? "").trim();
  const targetRecordId = String(filters.targetRecordId ?? "").trim();
  const dateFrom = String(filters.dateFrom ?? "").trim();
  const dateTo = String(filters.dateTo ?? "").trim();

  return {
    action: allowedAuditActions.has(action) ? action : "",
    targetTable: allowedAuditTables.has(targetTable) ? targetTable : "",
    actor: actor.slice(0, 320),
    targetRecordId: targetRecordId.slice(0, 100),
    dateFrom: dateFrom && !Number.isNaN(Date.parse(dateFrom)) ? dateFrom : "",
    dateTo: dateTo && !Number.isNaN(Date.parse(dateTo)) ? dateTo : "",
    limit: normalizedLimit(filters.limit),
  };
}

export async function listAuditEvents(pool, filters = {}) {
  const normalized = normalizeAuditFilters(filters);
  const conditions = [];
  const values = [];

  if (normalized.action) {
    values.push(normalized.action);
    conditions.push(`action = $${values.length}`);
  }

  if (normalized.targetTable) {
    values.push(normalized.targetTable);
    conditions.push(`target_table = $${values.length}`);
  }

  if (normalized.targetRecordId) {
    values.push(`%${normalized.targetRecordId}%`);
    conditions.push(`target_record_id ILIKE $${values.length}`);
  }

  if (normalized.actor) {
    values.push(`%${normalized.actor}%`);
    conditions.push(`(
      actor_email ILIKE $${values.length}
      OR actor_external_subject ILIKE $${values.length}
      OR actor_database_user ILIKE $${values.length}
      OR actor_session_user ILIKE $${values.length}
    )`);
  }

  if (normalized.dateFrom) {
    values.push(normalized.dateFrom);
    conditions.push(`occurred_at >= $${values.length}::timestamptz`);
  }

  if (normalized.dateTo) {
    values.push(normalized.dateTo);
    conditions.push(`occurred_at <= $${values.length}::timestamptz`);
  }

  values.push(normalized.limit);
  const result = await pool.query(
    `
      SELECT
        id::text,
        occurred_at,
        action,
        target_table,
        target_record_id,
        actor_email,
        actor_role,
        actor_external_subject,
        actor_database_user,
        actor_session_user,
        source,
        reason,
        changed_fields,
        previous_values,
        new_values,
        metadata
      FROM audit_events
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY occurred_at DESC, id DESC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows.map(toAuditEvent);
}
