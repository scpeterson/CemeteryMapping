import assert from "node:assert/strict";
import test from "node:test";
import { listReportsForUser, matchReportQuery, runReport } from "./reportsRepository.mjs";

const cemeteryId = "11111111-1111-4111-8111-111111111111";
const admin = { role: "admin" };
const cemeteryAdmin = { role: "cemetery-admin", cemeteryAccess: [{ cemeteryId }] };
function fixture(rows = []) {
  const queries = [];
  return {
    queries,
    async connect() {
      return { async query(sql, values) { queries.push({ sql, values }); return { rows }; }, release() {} };
    },
  };
}

test("missing NHG links is restricted to cemetery admins and higher", async () => {
  for (const role of ["reader", "power-user", undefined]) {
    assert.ok(!listReportsForUser({ role }).some((r) => r.id === "missing-nhg-links"));
    await assert.rejects(() => runReport({ connect() { throw new Error("Must not query"); } }, "missing-nhg-links", {}, { role }), { code: "REPORT_FORBIDDEN" });
  }
  for (const user of [admin, cemeteryAdmin]) {
    assert.ok(listReportsForUser(user).some((r) => r.id === "missing-nhg-links"));
  }
  assert.equal(matchReportQuery("Which graves and monuments do not have NHG links?").report.id, "missing-nhg-links");
  assert.equal(matchReportQuery("Missing North Hills evidence links").report.id, "missing-nhg-links");
});

test("missing NHG links checks monuments and excludes Not listed in NHG", async () => {
  const pool = fixture([
    { monument: "TLC-HS-0087", gravesites: "A-0087", direct_link: false, nhg_inclusion: "listed" },
    { monument: "TLC-HS-0270", gravesites: "C-0270", direct_link: false, nhg_inclusion: "not_checked" },
    { monument: "TLC-HS-PLOT", gravesites: null, direct_link: false, nhg_inclusion: "unclear", marker_scope: "Plot marker" },
    { monument: "TLC-HS-0561", direct_link: true, nhg_inclusion: "listed" },
    { monument: "TLC-HS-EXCLUDED", direct_link: false, nhg_inclusion: "not_listed" },
    { monument: "TLC-HS-EXCLUDED-LINKED", direct_link: true, nhg_inclusion: "not_listed" },
  ]);
  const result = await runReport(pool, "missing-nhg-links", {}, cemeteryAdmin);
  assert.match(result.summary, /4 eligible monuments checked; 3 lack/u);
  assert.deepEqual(result.rows.map((r) => [r.gravesites, r.monument, r.nhg_inclusion]), [
    ["A-0087", "TLC-HS-0087", "Listed in NHG"], ["C-0270", "TLC-HS-0270", "Not checked"],
    ["Standalone monument", "TLC-HS-PLOT", "Unclear"],
  ]);
  assert.equal(result.rows[2].marker_scope, "Plot marker");
  assert.ok(!result.columns.some((c) => ["kind", "related_link"].includes(c.key)));
  assert.deepEqual(pool.queries[0].values, [[cemeteryId]]);
  assert.match(pool.queries[0].sql, /status = 'linked'/u);
  assert.match(pool.queries[0].sql, /NormalizedProvenance,nhgInclusion/u);
  assert.doesNotMatch(pool.queries[0].sql, /north_hills_ocr_entry_gravesite_links/u);
  assert.match(pool.queries[0].sql, /hg.deleted_at IS NULL/u);
  assert.match(pool.queries[0].sql, /ST_Covers/u);
});

test("NHG report scope cannot be overridden by cemetery admins and supports admin filtering", async () => {
  const pool = fixture();
  await runReport(pool, "missing-nhg-links", { cemeteryId: "untrusted" }, cemeteryAdmin);
  assert.deepEqual(pool.queries.at(-1).values, [[cemeteryId]]);
  await runReport(pool, "missing-nhg-links", {}, { role: "cemetery-admin", cemeteryAccess: [] });
  assert.match(pool.queries.at(-1).sql, /AND false/u);
  await runReport(pool, "missing-nhg-links", { cemeteryId }, admin);
  assert.deepEqual(pool.queries.at(-1).values, [[cemeteryId]]);
  await runReport(pool, "missing-nhg-links", {}, admin);
  assert.deepEqual(pool.queries.at(-1).values, []);
});
