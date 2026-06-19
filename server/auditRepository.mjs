import { withAuditContext } from "./auditContext.mjs";

const allowedAuditActions = new Set(["create", "update", "soft_delete", "restore", "delete", "import_promote"]);
const allowedAuditTables = new Set([
  "app_roles",
  "app_users",
  "audit_retention_policies",
  "blocks",
  "burials",
  "burial_interment_types",
  "cemeteries",
  "deed_registry_entries",
  "deed_registry_entry_allocations",
  "deed_registry_import_batches",
  "deed_investigation_case_entries",
  "deed_investigation_case_actions",
  "deed_investigation_cases",
  "gravesites",
  "gravesite_status_types",
  "headstone_burials",
  "headstone_condition_types",
  "headstone_gravesites",
  "headstone_vase_material_types",
  "headstone_vase_placement_types",
  "headstone_vase_types",
  "headstones",
  "lot_owner_parties",
  "lot_ownership_event_types",
  "lots",
  "marker_material_types",
  "marker_types",
  "military_branch_types",
  "military_rank_types",
  "military_war_service_types",
  "gravesite_media_assets",
  "headstone_media_assets",
  "media_assets",
  "memorials",
  "north_hills_ocr_source_facts",
  "north_hills_ocr_entry_gravesite_links",
  "north_hills_ocr_entry_headstone_links",
  "owners",
  "ownership_event_parties",
  "ownership_event_rights",
  "ownership_events",
  "ownership_parties",
  "sections",
  "system_event_retention_policies",
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

function normalizedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizedBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function toAuditRetentionPolicy(row) {
  return {
    retentionDays: row.retention_days,
    minimumProtectedDays: row.minimum_protected_days,
    batchSize: row.batch_size,
    isEnabled: row.is_enabled,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export function normalizeAuditRetentionPolicyInput(input = {}, currentPolicy = {}) {
  const minimumProtectedDays = normalizedInteger(input.minimumProtectedDays, currentPolicy.minimumProtectedDays ?? 365, 365, 36500);
  const retentionDays = normalizedInteger(input.retentionDays, currentPolicy.retentionDays ?? 2555, minimumProtectedDays, 36500);

  return {
    retentionDays,
    minimumProtectedDays: Math.min(minimumProtectedDays, retentionDays),
    batchSize: normalizedInteger(input.batchSize, currentPolicy.batchSize ?? 5000, 1, 50000),
    isEnabled: normalizedBoolean(input.isEnabled, currentPolicy.isEnabled ?? true),
  };
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

export async function getAuditRetentionPolicy(pool) {
  const result = await pool.query(
    `
      SELECT
        retention_days,
        minimum_protected_days,
        batch_size,
        is_enabled,
        created_at,
        updated_at
      FROM audit_retention_policies
      WHERE id = 1
    `,
  );

  return toAuditRetentionPolicy(result.rows[0]);
}

export async function updateAuditRetentionPolicy(pool, input, audit = {}) {
  const currentPolicy = await getAuditRetentionPolicy(pool);
  const normalized = normalizeAuditRetentionPolicyInput(input, currentPolicy);

  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        INSERT INTO audit_retention_policies (
          id,
          retention_days,
          minimum_protected_days,
          batch_size,
          is_enabled
        )
        VALUES (1, $1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
        SET
          retention_days = EXCLUDED.retention_days,
          minimum_protected_days = EXCLUDED.minimum_protected_days,
          batch_size = EXCLUDED.batch_size,
          is_enabled = EXCLUDED.is_enabled
        RETURNING
          retention_days,
          minimum_protected_days,
          batch_size,
          is_enabled,
          created_at,
          updated_at
      `,
      [normalized.retentionDays, normalized.minimumProtectedDays, normalized.batchSize, normalized.isEnabled],
    );

    return toAuditRetentionPolicy(result.rows[0]);
  });
}

export async function purgeAuditEvents(pool) {
  const result = await pool.query(
    `
      WITH policy AS (
        SELECT
          retention_days,
          batch_size,
          is_enabled,
          now() - make_interval(days => retention_days) AS cutoff_at
        FROM audit_retention_policies
        WHERE id = 1
      ),
      eligible AS (
        SELECT audit_events.id
        FROM audit_events
        CROSS JOIN policy
        WHERE policy.is_enabled
          AND audit_events.occurred_at < policy.cutoff_at
        ORDER BY audit_events.occurred_at ASC, audit_events.id ASC
        LIMIT (SELECT batch_size FROM policy)
      ),
      deleted AS (
        DELETE FROM audit_events
        WHERE id IN (SELECT id FROM eligible)
        RETURNING id
      )
      SELECT
        policy.retention_days,
        policy.batch_size,
        policy.is_enabled,
        policy.cutoff_at,
        (SELECT count(*)::integer FROM eligible) AS selected_count,
        (SELECT count(*)::integer FROM deleted) AS deleted_count
      FROM policy
    `,
  );

  const row = result.rows[0];
  return {
    retentionDays: row.retention_days,
    batchSize: row.batch_size,
    isEnabled: row.is_enabled,
    cutoffAt: row.cutoff_at?.toISOString?.() ?? row.cutoff_at,
    selectedCount: row.selected_count,
    deletedCount: row.deleted_count,
  };
}
