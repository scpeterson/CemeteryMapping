import assert from "node:assert/strict";
import test from "node:test";
import { createLookupRecord, listLookupRecords, lookupTables, updateLookupRecord } from "./lookupAdminRepository.mjs";

test("lookupTables exposes only admin-maintained lookup tables", () => {
  assert.deepEqual(
    lookupTables().map((table) => table.table),
    [
      "marker_types",
      "marker_material_types",
      "headstone_condition_types",
      "gravesite_status_types",
      "burial_interment_types",
      "lot_ownership_event_types",
      "military_branch_types",
      "military_war_service_types",
    ],
  );
});

test("listLookupRecords reads source fields only for marker lookup tables", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async connect() {
      return client;
    },
  };

  const result = await listLookupRecords(pool);

  assert.equal(result.tables.length, 8);
  assert.match(queries[0], /source_notes, source_url/u);
  assert.match(queries[0], /usage_records\.marker_type_id = marker_types\.id/u);
  assert.doesNotMatch(queries[2], /source_notes, source_url/u);
  assert.match(queries[3], /usage_records\.status_type_id = gravesite_status_types\.id/u);
  assert.match(queries[4], /usage_records\.interment_type_id = burial_interment_types\.id/u);
  assert.match(queries[6], /usage_records\.military_branch_type_id = military_branch_types\.id/u);
  assert.match(queries[7], /usage_records\.military_war_service_type_id = military_war_service_types\.id/u);
});

test("updateLookupRecord uses an allowlisted table and audit transaction", async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (/RETURNING id::text/u.test(sql)) {
        return {
          rows: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              code: "occupied",
              label: "Occupied",
              description: "Occupied status",
              sort_order: 30,
              is_active: true,
              usage_count: "12",
              created_at: "2026-05-28T00:00:00.000Z",
              updated_at: "2026-05-28T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async connect() {
      return client;
    },
  };

  const updated = await updateLookupRecord(
    pool,
    "gravesite_status_types",
    "22222222-2222-4222-8222-222222222222",
    { label: "Occupied", description: "Occupied status", sortOrder: 30, isActive: true },
    { actorUser: { id: "11111111-1111-4111-8111-111111111111" } },
  );

  assert.equal(queries[0].sql, "BEGIN");
  assert.match(queries.at(-2).sql, /UPDATE gravesite_status_types/u);
  assert.deepEqual(queries.at(-2).values, ["22222222-2222-4222-8222-222222222222", "Occupied", "Occupied status", 30, true]);
  assert.equal(queries.at(-1).sql, "COMMIT");
  assert.equal(updated.label, "Occupied");
  assert.equal(updated.usageCount, 12);
  assert.equal(updated.usageLabel, "gravesites");
});

test("createLookupRecord rejects unsupported lookup tables before SQL is built", async () => {
  await assert.rejects(
    () => createLookupRecord({}, "cemeteries", { code: "x", label: "X", description: "No", sortOrder: 1, isActive: true }),
    /Unsupported lookup table: cemeteries/u,
  );
});
