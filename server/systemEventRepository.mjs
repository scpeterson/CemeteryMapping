import { withAuditContext } from "./auditContext.mjs";

const eventTypes = new Set(["error", "warning", "job_run", "health_check", "integration_failure"]);
const severities = new Set(["info", "warning", "error", "critical"]);
const statuses = new Set(["started", "succeeded", "failed", "degraded", "reported", "resolved", ""]);

function cleanText(value, maxLength) {
  const text = String(value ?? "").trim();
  return text.slice(0, maxLength);
}

function cleanInteger(value, min, max) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(Math.max(parsed, min), max);
}

function cleanBoundedInteger(value, min, max) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

function normalizedInteger(value, fallback, min, max) {
  return cleanInteger(value, min, max) ?? fallback;
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

function normalizedLimit(limit) {
  return cleanInteger(limit, 1, 100) ?? 50;
}

function normalizeDate(value) {
  const text = cleanText(value, 40);
  return text && !Number.isNaN(Date.parse(text)) ? text : "";
}

function toSystemEvent(row) {
  return {
    id: row.id,
    occurredAt: row.occurred_at?.toISOString?.() ?? row.occurred_at,
    eventType: row.event_type,
    severity: row.severity,
    source: row.source,
    status: row.status ?? "",
    message: row.message,
    detail: row.detail ?? "",
    requestMethod: row.request_method ?? "",
    requestPath: row.request_path ?? "",
    responseStatus: row.response_status ?? undefined,
    actorEmail: row.actor_email ?? "",
    actorRole: row.actor_role ?? "",
    environment: row.environment ?? "",
    appVersion: row.app_version ?? "",
    durationMs: row.duration_ms ?? undefined,
    metadata: row.metadata ?? {},
  };
}

function toSystemEventRetentionPolicy(row) {
  return {
    retentionDays: row.retention_days,
    minimumProtectedDays: row.minimum_protected_days,
    batchSize: row.batch_size,
    isEnabled: row.is_enabled,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export function normalizeSystemEventFilters(filters = {}) {
  const eventType = cleanText(filters.eventType, 50);
  const severity = cleanText(filters.severity, 20);
  const source = cleanText(filters.source, 100);
  const status = cleanText(filters.status, 50);
  const q = cleanText(filters.q, 200);

  return {
    eventType: eventTypes.has(eventType) ? eventType : "",
    severity: severities.has(severity) ? severity : "",
    source,
    status: statuses.has(status) ? status : "",
    q,
    dateFrom: normalizeDate(filters.dateFrom),
    dateTo: normalizeDate(filters.dateTo),
    limit: normalizedLimit(filters.limit),
  };
}

export function normalizeSystemEventInput(input = {}) {
  const eventType = eventTypes.has(input.eventType) ? input.eventType : "error";
  const severity = severities.has(input.severity) ? input.severity : eventType === "job_run" ? "info" : "error";
  const status = statuses.has(input.status) ? input.status : "";

  return {
    eventType,
    severity,
    source: cleanText(input.source, 100) || "application",
    status: status || undefined,
    message: cleanText(input.message, 1000) || "System event recorded.",
    detail: cleanText(input.detail, 10000) || undefined,
    requestMethod: cleanText(input.requestMethod, 10) || undefined,
    requestPath: cleanText(input.requestPath, 500) || undefined,
    responseStatus: cleanBoundedInteger(input.responseStatus, 100, 599),
    actorEmail: cleanText(input.actorEmail, 320) || undefined,
    actorRole: cleanText(input.actorRole, 50) || undefined,
    environment: cleanText(input.environment, 20) || undefined,
    appVersion: cleanText(input.appVersion, 100) || undefined,
    durationMs: cleanBoundedInteger(input.durationMs, 0, 2_147_483_647),
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {},
  };
}

export function normalizeSystemEventRetentionPolicyInput(input = {}, currentPolicy = {}) {
  const minimumProtectedDays = normalizedInteger(input.minimumProtectedDays, currentPolicy.minimumProtectedDays ?? 30, 30, 36500);
  const retentionDays = normalizedInteger(input.retentionDays, currentPolicy.retentionDays ?? 365, minimumProtectedDays, 36500);

  return {
    retentionDays,
    minimumProtectedDays: Math.min(minimumProtectedDays, retentionDays),
    batchSize: normalizedInteger(input.batchSize, currentPolicy.batchSize ?? 5000, 1, 50000),
    isEnabled: normalizedBoolean(input.isEnabled, currentPolicy.isEnabled ?? true),
  };
}

export async function recordSystemEvent(pool, input) {
  const event = normalizeSystemEventInput(input);
  const result = await pool.query(
    `
      INSERT INTO system_events (
        event_type,
        severity,
        source,
        status,
        message,
        detail,
        request_method,
        request_path,
        response_status,
        actor_email,
        actor_role,
        environment,
        app_version,
        duration_ms,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      RETURNING
        id::text,
        occurred_at,
        event_type,
        severity,
        source,
        status,
        message,
        detail,
        request_method,
        request_path,
        response_status,
        actor_email,
        actor_role,
        environment,
        app_version,
        duration_ms,
        metadata
    `,
    [
      event.eventType,
      event.severity,
      event.source,
      event.status,
      event.message,
      event.detail,
      event.requestMethod,
      event.requestPath,
      event.responseStatus,
      event.actorEmail,
      event.actorRole,
      event.environment,
      event.appVersion,
      event.durationMs,
      JSON.stringify(event.metadata),
    ],
  );

  return toSystemEvent(result.rows[0]);
}

export async function safelyRecordSystemEvent(pool, input) {
  try {
    return await recordSystemEvent(pool, input);
  } catch (error) {
    console.error("Unable to record system event.", error);
    return undefined;
  }
}

export async function listSystemEvents(pool, filters = {}) {
  const normalized = normalizeSystemEventFilters(filters);
  const conditions = [];
  const values = [];

  if (normalized.eventType) {
    values.push(normalized.eventType);
    conditions.push(`event_type = $${values.length}`);
  }

  if (normalized.severity) {
    values.push(normalized.severity);
    conditions.push(`severity = $${values.length}`);
  }

  if (normalized.source) {
    values.push(`%${normalized.source}%`);
    conditions.push(`source ILIKE $${values.length}`);
  }

  if (normalized.status) {
    values.push(normalized.status);
    conditions.push(`status = $${values.length}`);
  }

  if (normalized.q) {
    values.push(`%${normalized.q}%`);
    conditions.push(`(
      message ILIKE $${values.length}
      OR detail ILIKE $${values.length}
      OR request_path ILIKE $${values.length}
      OR actor_email ILIKE $${values.length}
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
        event_type,
        severity,
        source,
        status,
        message,
        detail,
        request_method,
        request_path,
        response_status,
        actor_email,
        actor_role,
        environment,
        app_version,
        duration_ms,
        metadata
      FROM system_events
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY occurred_at DESC, id DESC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows.map(toSystemEvent);
}

export function jobRunEvent(input = {}) {
  return {
    ...input,
    eventType: "job_run",
    severity: input.status === "failed" ? "error" : "info",
  };
}

export async function safelyRecordJobRun(pool, input) {
  return safelyRecordSystemEvent(pool, jobRunEvent(input));
}

export async function getSystemEventRetentionPolicy(pool) {
  const result = await pool.query(
    `
      SELECT
        retention_days,
        minimum_protected_days,
        batch_size,
        is_enabled,
        created_at,
        updated_at
      FROM system_event_retention_policies
      WHERE id = 1
    `,
  );

  return toSystemEventRetentionPolicy(result.rows[0]);
}

export async function updateSystemEventRetentionPolicy(pool, input, audit = {}) {
  const currentPolicy = await getSystemEventRetentionPolicy(pool);
  const normalized = normalizeSystemEventRetentionPolicyInput(input, currentPolicy);

  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        INSERT INTO system_event_retention_policies (
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

    return toSystemEventRetentionPolicy(result.rows[0]);
  });
}

export async function purgeSystemEvents(pool) {
  const result = await pool.query(
    `
      WITH policy AS (
        SELECT
          retention_days,
          batch_size,
          is_enabled,
          now() - make_interval(days => retention_days) AS cutoff_at
        FROM system_event_retention_policies
        WHERE id = 1
      ),
      eligible AS (
        SELECT system_events.id
        FROM system_events
        CROSS JOIN policy
        WHERE policy.is_enabled
          AND system_events.occurred_at < policy.cutoff_at
        ORDER BY system_events.occurred_at ASC, system_events.id ASC
        LIMIT (SELECT batch_size FROM policy)
      ),
      deleted AS (
        DELETE FROM system_events
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
