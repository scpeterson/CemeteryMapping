import assert from "node:assert/strict";
import test from "node:test";
import { validateSearchPage, validateSearchQuery, validateStatuses } from "./requestValidation.mjs";
import { searchCemetery } from "./cemeterySearch.mjs";
import { registerReportRoutes } from "./routes/reportRoutes.mjs";
const cemeteryId = "11111111-1111-4111-8111-111111111111";
test("search pagination validates defaults, bounds and UUID scope", () => {
  assert.deepEqual(validateSearchPage(), { limit: 50, offset: 0, cemeteryId: undefined });
  assert.deepEqual(validateSearchPage({ limit: "100", offset: "50", cemeteryId }), { limit: 100, offset: 50, cemeteryId });
  for (const page of [{ limit: "0" }, { limit: "101" }, { offset: "-1" }, { offset: "1.5" }, { offset: "100001" }, { cemeteryId: "invalid" }, { limit: ["50"] }]) {
    assert.throws(() => validateSearchPage(page), { statusCode: 400 });
  }
});
test("search preserves all unique reasons for each returned grave", async () => {
  const row = { cemetery_id: cemeteryId, gravesite_id: "A-1", status: "occupied", geometry: null, reason_label: "Burial", reason_value: "Garcia" };
  const pool = { async query(_sql, values) {
    assert.deepEqual(values, ["garcia", [], false, [], cemeteryId, 3, 50]);
    return { rows: [row, row, { ...row, reason_label: "Lot", reason_value: "1" }] };
  } };
  const matches = await searchCemetery(pool, { query: "Garcia", includeOwnership: false, ownershipCemeteryIds: [], cemeteryId, limit: 2, offset: 50 });
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].reasons, ["Burial: Garcia", "Lot: 1"]);
});
test("search route returns a bounded array and continuation header without broadening ownership", async () => {
  let handler;
  const app = { get(path, ...handlers) { if (path === "/api/search") handler = handlers.at(-1); }, post() {} };
  let options;
  registerReportRoutes(app, { assignedEditableCemeteryIds: () => [cemeteryId], validateSearchQuery, validateStatuses, searchCemetery: async (_pool, input) => { options = input; return [{ grave: { id: "A" } }, { grave: { id: "B" } }, { grave: { id: "C" } }]; } });
  const headers = {}; let body;
  await handler({ query: { q: "Name", limit: "2", offset: "4", cemeteryId }, user: { role: "reader" } }, { set(name, value) { headers[name] = value; }, json(value) { body = value; } }, (error) => { throw error; });
  assert.equal(body.length, 2);
  assert.equal(headers["X-Search-Has-More"], "true");
  assert.deepEqual(options, { query: "Name", statuses: [], cemeteryId, offset: 4, limit: 2, includeOwnership: false, ownershipCemeteryIds: [cemeteryId] });
});
