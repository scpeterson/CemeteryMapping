import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { requireRole } from "./auth.mjs";
import { registerAdminGovernanceRoutes } from "./routes/adminGovernanceRoutes.mjs";
import { validateLookupPayload, validateLookupTable } from "./routes/adminRouteValidation.mjs";
import { validateUuid } from "./inputValidation.mjs";
import { lookupTables } from "./lookupAdminRepository.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const body = { code: "star", label: "Star", description: "Veteran star", isActive: true };
const tables = ["grave_feature_types", "grave_feature_subtypes", "grave_feature_material_types", "grave_feature_placement_types"];
test("grave feature subtype validation accepts a UUID or an all-types parent and rejects malformed IDs", () => {
  for (const value of [null, "", undefined]) assert.equal(validateLookupPayload({ ...body, graveFeatureTypeId: value }, tables[1]).graveFeatureTypeId, null);
  assert.equal(validateLookupPayload({ ...body, graveFeatureTypeId: id }, tables[1]).graveFeatureTypeId, id);
  assert.throws(() => validateLookupPayload({ ...body, graveFeatureTypeId: "not-a-uuid" }, tables[1]), /Grave feature type/);
  assert.equal(lookupTables().filter(t => tables.includes(t.table)).length, 4);
});

test("shared grave feature lookup list/create/edit routes require system admin and pass actor context", async t => {
  const app = express(); app.use(express.json());
  const calls = [];
  registerAdminGovernanceRoutes(app, {
    requirePowerUser: (_req, _res, next) => next(),
    requireCemeteryAdmin: (_req, _res, next) => next(),
    requireAdmin: requireRole({ mode: "trusted-header", roleHeader: "x-role", emailHeader: "x-email", subjectHeader: "x-subject" }, "admin"),
    validateLookupPayload, validateLookupTable, validateUuid,
    listLookupRecords: async () => ({ tables: lookupTables(), lookups: {} }),
    createLookupRecord: async (_pool, table, record, context) => { calls.push({ table, record, context }); return { id, ...record }; },
    updateLookupRecord: async (_pool, table, _id, record, context) => { calls.push({ table, record, context }); return { id, ...record }; },
  });
  app.use((error, _req, res, next) => { if (res.headersSent) return next(error); res.status(error.statusCode ?? 500).json({ error: error.message }); });
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const role of [undefined, "reader", "power-user", "cemetery-admin", "admin"]) {
    const headers = { "Content-Type": "application/json", ...(role ? { "x-role": role, "x-email": "admin@example.test" } : {}) };
    assert.equal((await fetch(base + "/api/admin/lookups", { headers })).status, role === "admin" ? 200 : role ? 403 : 401);
    for (const table of tables) for (const method of ["POST", "PUT"]) {
      const path = `/api/admin/lookups/${table}${method === "PUT" ? "/" + id : ""}`;
      const response = await fetch(base + path, { method, headers, body: JSON.stringify({ ...body, graveFeatureTypeId: id }) });
      assert.equal(response.status, role === "admin" ? method === "POST" ? 201 : 200 : role ? 403 : 401);
    }
  }
  assert.equal(calls.length, 8);
  assert.ok(calls.every(c => c.context.actorUser.role === "admin"));
  assert.ok(calls.filter(c => c.table === tables[1]).every(c => c.record.graveFeatureTypeId === id));
});
