import assert from "node:assert/strict";
import test from "node:test";
import {
  jobRunEvent,
  listSystemEvents,
  normalizeSystemEventFilters,
  normalizeSystemEventInput,
  normalizeSystemEventRetentionPolicyInput,
  purgeSystemEvents,
  recordSystemEvent,
  safelyRecordSystemEvent,
} from "./systemEventRepository.mjs";

test("normalizeSystemEventFilters clamps unsupported values and limits", () => {
  assert.deepEqual(
    normalizeSystemEventFilters({
      eventType: "drop",
      severity: "panic",
      source: "api".repeat(80),
      status: "unknown",
      q: "x".repeat(250),
      dateFrom: "not a date",
      dateTo: "2026-06-11",
      limit: 500,
    }),
    {
      eventType: "",
      severity: "",
      source: "api".repeat(80).slice(0, 100),
      status: "",
      q: "x".repeat(200),
      dateFrom: "",
      dateTo: "2026-06-11",
      limit: 100,
    },
  );
});

test("normalizeSystemEventInput defaults invalid operational event fields", () => {
  assert.deepEqual(
    normalizeSystemEventInput({
      eventType: "bogus",
      severity: "loud",
      source: "",
      status: "started",
      message: "",
      responseStatus: 999,
      durationMs: -1,
      metadata: [],
    }),
    {
      eventType: "error",
      severity: "error",
      source: "application",
      status: "started",
      message: "System event recorded.",
      detail: undefined,
      requestMethod: undefined,
      requestPath: undefined,
      responseStatus: undefined,
      actorEmail: undefined,
      actorRole: undefined,
      environment: undefined,
      appVersion: undefined,
      durationMs: undefined,
      metadata: {},
    },
  );
});

test("normalizeSystemEventRetentionPolicyInput keeps retention settings in bounded ranges", () => {
  assert.deepEqual(
    normalizeSystemEventRetentionPolicyInput({
      retentionDays: 10,
      minimumProtectedDays: 60,
      batchSize: 100000,
      isEnabled: "false",
    }),
    {
      retentionDays: 60,
      minimumProtectedDays: 60,
      batchSize: 50000,
      isEnabled: false,
    },
  );
});

test("jobRunEvent preserves job run event type and severity defaults", () => {
  assert.deepEqual(
    jobRunEvent({
      eventType: "error",
      severity: "critical",
      status: "failed",
      message: "boom",
    }),
    {
      eventType: "job_run",
      severity: "error",
      status: "failed",
      message: "boom",
    },
  );
});

test("recordSystemEvent inserts normalized event details", async () => {
  let capturedSql = "";
  let capturedValues = [];
  const pool = {
    async query(sql, values) {
      capturedSql = sql;
      capturedValues = values;
      return {
        rows: [
          {
            id: "event-1",
            occurred_at: "2026-06-11T20:30:00.000Z",
            event_type: "error",
            severity: "error",
            source: "api",
            status: "failed",
            message: "Broken route",
            detail: "stack",
            request_method: "GET",
            request_path: "/api/broken",
            response_status: 500,
            actor_email: "admin@example.test",
            actor_role: "admin",
            environment: "dev",
            app_version: "0.1.0",
            duration_ms: 12,
            metadata: { gitSha: "abc123" },
          },
        ],
      };
    },
  };

  const event = await recordSystemEvent(pool, {
    eventType: "error",
    severity: "error",
    source: "api",
    status: "failed",
    message: "Broken route",
    detail: "stack",
    requestMethod: "GET",
    requestPath: "/api/broken",
    responseStatus: 500,
    actorEmail: "admin@example.test",
    actorRole: "admin",
    environment: "dev",
    appVersion: "0.1.0",
    durationMs: 12,
    metadata: { gitSha: "abc123" },
  });

  assert.match(capturedSql, /INSERT INTO system_events/u);
  assert.deepEqual(capturedValues.slice(0, 5), ["error", "error", "api", "failed", "Broken route"]);
  assert.equal(capturedValues.at(-1), JSON.stringify({ gitSha: "abc123" }));
  assert.deepEqual(event, {
    id: "event-1",
    occurredAt: "2026-06-11T20:30:00.000Z",
    eventType: "error",
    severity: "error",
    source: "api",
    status: "failed",
    message: "Broken route",
    detail: "stack",
    requestMethod: "GET",
    requestPath: "/api/broken",
    responseStatus: 500,
    actorEmail: "admin@example.test",
    actorRole: "admin",
    environment: "dev",
    appVersion: "0.1.0",
    durationMs: 12,
    metadata: { gitSha: "abc123" },
  });
});

test("listSystemEvents builds filters with search terms", async () => {
  let capturedSql = "";
  let capturedValues = [];
  const pool = {
    async query(sql, values) {
      capturedSql = sql;
      capturedValues = values;
      return { rows: [] };
    },
  };

  await listSystemEvents(pool, {
    eventType: "job_run",
    severity: "error",
    source: "db:purge",
    status: "failed",
    q: "timeout",
    limit: 25,
  });

  assert.match(capturedSql, /event_type = \$1/u);
  assert.match(capturedSql, /severity = \$2/u);
  assert.match(capturedSql, /source ILIKE \$3/u);
  assert.match(capturedSql, /status = \$4/u);
  assert.match(capturedSql, /message ILIKE \$5/u);
  assert.deepEqual(capturedValues, ["job_run", "error", "%db:purge%", "failed", "%timeout%", 25]);
});

test("safelyRecordSystemEvent swallows recording errors", async () => {
  const pool = {
    async query() {
      throw new Error("event table missing");
    },
  };

  const originalConsoleError = console.error;
  const messages = [];
  console.error = (...args) => messages.push(args);
  try {
    const result = await safelyRecordSystemEvent(pool, { message: "try" });
    assert.equal(result, undefined);
    assert.equal(messages.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});

test("purgeSystemEvents deletes one configured batch of old system event records", async () => {
  let capturedSql = "";
  const pool = {
    async query(sql) {
      capturedSql = sql;
      return {
        rows: [
          {
            retention_days: 365,
            batch_size: 5000,
            is_enabled: true,
            cutoff_at: "2025-06-11T00:00:00.000Z",
            selected_count: 5000,
            deleted_count: 5000,
          },
        ],
      };
    },
  };

  const result = await purgeSystemEvents(pool);

  assert.match(capturedSql, /WITH policy AS/u);
  assert.match(capturedSql, /system_events\.occurred_at < policy\.cutoff_at/u);
  assert.match(capturedSql, /LIMIT \(SELECT batch_size FROM policy\)/u);
  assert.match(capturedSql, /DELETE FROM system_events/u);
  assert.deepEqual(result, {
    retentionDays: 365,
    batchSize: 5000,
    isEnabled: true,
    cutoffAt: "2025-06-11T00:00:00.000Z",
    selectedCount: 5000,
    deletedCount: 5000,
  });
});
