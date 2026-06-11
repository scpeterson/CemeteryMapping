import assert from "node:assert/strict";
import test from "node:test";
import { listAuditEvents, normalizeAuditFilters, normalizeAuditRetentionPolicyInput, purgeAuditEvents } from "./auditRepository.mjs";

test("normalizeAuditFilters clamps limits and ignores unsupported actions or tables", () => {
  assert.deepEqual(
    normalizeAuditFilters({
      action: "drop table",
      targetTable: "not_a_table",
      actor: "a".repeat(400),
      targetRecordId: "b".repeat(150),
      dateFrom: "not a date",
      dateTo: "2026-05-26",
      limit: 500,
    }),
    {
      action: "",
      targetTable: "",
      actor: "a".repeat(320),
      targetRecordId: "b".repeat(100),
      dateFrom: "",
      dateTo: "2026-05-26",
      limit: 100,
    },
  );
});

test("normalizeAuditFilters allows headstone gravesite link audit records", () => {
  assert.equal(normalizeAuditFilters({ targetTable: "headstone_gravesites" }).targetTable, "headstone_gravesites");
});

test("normalizeAuditFilters allows North Hills evidence link audit records", () => {
  assert.equal(normalizeAuditFilters({ targetTable: "north_hills_ocr_entry_gravesite_links" }).targetTable, "north_hills_ocr_entry_gravesite_links");
  assert.equal(normalizeAuditFilters({ targetTable: "north_hills_ocr_entry_headstone_links" }).targetTable, "north_hills_ocr_entry_headstone_links");
});

test("normalizeAuditFilters allows marker lookup audit records", () => {
  assert.equal(normalizeAuditFilters({ targetTable: "marker_types" }).targetTable, "marker_types");
  assert.equal(normalizeAuditFilters({ targetTable: "marker_material_types" }).targetTable, "marker_material_types");
  assert.equal(normalizeAuditFilters({ targetTable: "burial_interment_types" }).targetTable, "burial_interment_types");
  assert.equal(normalizeAuditFilters({ targetTable: "military_branch_types" }).targetTable, "military_branch_types");
  assert.equal(normalizeAuditFilters({ targetTable: "military_war_service_types" }).targetTable, "military_war_service_types");
});

test("normalizeAuditFilters allows status and event lookup audit records", () => {
  assert.equal(normalizeAuditFilters({ targetTable: "headstone_condition_types" }).targetTable, "headstone_condition_types");
  assert.equal(normalizeAuditFilters({ targetTable: "gravesite_status_types" }).targetTable, "gravesite_status_types");
  assert.equal(normalizeAuditFilters({ targetTable: "lot_ownership_event_types" }).targetTable, "lot_ownership_event_types");
  assert.equal(normalizeAuditFilters({ targetTable: "ownership_events" }).targetTable, "ownership_events");
  assert.equal(normalizeAuditFilters({ targetTable: "ownership_event_rights" }).targetTable, "ownership_event_rights");
});

test("normalizeAuditFilters allows audit retention policy audit records", () => {
  assert.equal(normalizeAuditFilters({ targetTable: "audit_retention_policies" }).targetTable, "audit_retention_policies");
});

test("normalizeAuditRetentionPolicyInput keeps retention settings in bounded ranges", () => {
  assert.deepEqual(
    normalizeAuditRetentionPolicyInput({
      retentionDays: 90,
      minimumProtectedDays: 500,
      batchSize: 100000,
      isEnabled: "false",
    }),
    {
      retentionDays: 500,
      minimumProtectedDays: 500,
      batchSize: 50000,
      isEnabled: false,
    },
  );
});

test("listAuditEvents returns filtered audit records", async () => {
  let capturedSql = "";
  let capturedValues = [];
  const pool = {
    async query(sql, values) {
      capturedSql = sql;
      capturedValues = values;
      return {
        rows: [
          {
            id: "audit-1",
            occurred_at: "2026-05-26T14:00:00.000Z",
            action: "update",
            target_table: "sections",
            target_record_id: "section-1",
            actor_email: "admin@example.test",
            actor_role: "admin",
            actor_external_subject: "auth0|admin",
            actor_database_user: "cemetery_app",
            actor_session_user: "cemetery_app",
            source: "api",
            reason: "Correct name",
            changed_fields: ["name"],
            previous_values: { name: "A" },
            new_values: { name: "B" },
            metadata: { request_id: "request-1" },
          },
        ],
      };
    },
  };

  const events = await listAuditEvents(pool, {
    action: "update",
    targetTable: "sections",
    actor: "admin@example.test",
    targetRecordId: "section-1",
    limit: 25,
  });

  assert.match(capturedSql, /action = \$1/u);
  assert.match(capturedSql, /target_table = \$2/u);
  assert.match(capturedSql, /target_record_id ILIKE \$3/u);
  assert.match(capturedSql, /actor_email ILIKE \$4/u);
  assert.deepEqual(capturedValues, ["update", "sections", "%section-1%", "%admin@example.test%", 25]);
  assert.deepEqual(events, [
    {
      id: "audit-1",
      occurredAt: "2026-05-26T14:00:00.000Z",
      action: "update",
      targetTable: "sections",
      targetRecordId: "section-1",
      actorEmail: "admin@example.test",
      actorRole: "admin",
      actorExternalSubject: "auth0|admin",
      actorDatabaseUser: "cemetery_app",
      actorSessionUser: "cemetery_app",
      source: "api",
      reason: "Correct name",
      changedFields: ["name"],
      previousValues: { name: "A" },
      newValues: { name: "B" },
      metadata: { request_id: "request-1" },
    },
  ]);
});

test("purgeAuditEvents deletes one configured batch of old audit records", async () => {
  let capturedSql = "";
  const pool = {
    async query(sql) {
      capturedSql = sql;
      return {
        rows: [
          {
            retention_days: 2555,
            batch_size: 5000,
            is_enabled: true,
            cutoff_at: "2019-06-11T00:00:00.000Z",
            selected_count: 5000,
            deleted_count: 5000,
          },
        ],
      };
    },
  };

  const result = await purgeAuditEvents(pool);

  assert.match(capturedSql, /WITH policy AS/u);
  assert.match(capturedSql, /audit_events\.occurred_at < policy\.cutoff_at/u);
  assert.match(capturedSql, /LIMIT \(SELECT batch_size FROM policy\)/u);
  assert.match(capturedSql, /DELETE FROM audit_events/u);
  assert.deepEqual(result, {
    retentionDays: 2555,
    batchSize: 5000,
    isEnabled: true,
    cutoffAt: "2019-06-11T00:00:00.000Z",
    selectedCount: 5000,
    deletedCount: 5000,
  });
});
