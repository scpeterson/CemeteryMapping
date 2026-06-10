import assert from "node:assert/strict";
import test from "node:test";
import { listAuditEvents, normalizeAuditFilters } from "./auditRepository.mjs";

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
