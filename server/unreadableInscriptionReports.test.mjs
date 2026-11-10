import assert from "node:assert/strict";
import test from "node:test";
import { unreadableInscriptionReasons } from "./reports/unreadableInscriptionReports.mjs";
import { listReportsForUser, matchReportQuery, runReport } from "./reportsRepository.mjs";

for (const text of ["[illegible]", "[ILLEGIBLE]", "Name [Illegible Lines] dates", "some illegible text", "[-]", "[ -]", "[- ]", "[  -  ]", "[\n-\t]", "NAME [-] 1800 [-]"]) {
  test(`unreadable inscription matches ${JSON.stringify(text)}`, () => assert.ok(unreadableInscriptionReasons(text).length));
}
for (const text of [null, "", "Readable name", "[blank]", "1900-1980", "[-name]", "[--]", "[-?]", "illegibleness"]) {
  test(`unreadable inscription excludes ${JSON.stringify(text)}`, () => assert.deepEqual(unreadableInscriptionReasons(text), []));
}
test("unreadable inscription report is available to power users and above, not readers", async () => {
  const id = "unreadable-monument-inscriptions";
  for (const role of ["power-user", "cemetery-admin", "admin"]) assert.ok(listReportsForUser({ role }).some((r) => r.id === id));
  assert.ok(!listReportsForUser({ role: "reader" }).some((r) => r.id === id));
  await assert.rejects(runReport({ connect() { throw Error("Must not query"); } }, id, {}, { role: "reader" }), { code: "REPORT_FORBIDDEN" });
  for (const query of ["Which monuments have unreadable inscriptions?", "List inscriptions with [ - ].", "Inscription has [ILLEGIBLE LINES]", "Which inscriptions cannot be read?"]) assert.equal(matchReportQuery(query).report.id, id);
});
test("unreadable report includes current face text, ignores face history and scopes mixed cemetery roles", async () => {
  const cemetery = "11111111-1111-4111-8111-111111111111";
  const readerCemetery = "22222222-2222-4222-8222-222222222222";
  const queries = [];
  const pool = { async connect() { return { async query(sql, values) { queries.push({sql,values});return { rows: [
    {marker_uuid:"match",monument:"HS-1",cemetery_id:cemetery,section:"E",inspection_year:2026,inscription:"A readable name",faces:[{label:"Back",inscription:"Dates [ - ]"}]},
    {marker_uuid:"no-match",inscription:"Readable",faces:[{inscription:"Readable",historicalTranscriptions:[{text:"illegible"}]}]},
  ] }; }, release() {} }; } };
  const result = await runReport(pool,"unreadable-monument-inscriptions",{cemeteryId:readerCemetery},{role:"power-user",cemeteryAccess:[{cemeteryId:cemetery,role:"power-user"},{cemeteryId:readerCemetery,role:"reader"}]});
  assert.deepEqual(queries[0].values,[[cemetery]]);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].affected_surfaces,"Back");assert.equal(result.rows[0].inspection_date,"2026");
  assert.equal(result.rows[0].monumentRecord.id,"match");assert.match(result.rows[0].inscription,/Back: Dates \[ - \]/u);
  assert.equal(result.rows[0].gravesites,"Standalone marker");
});
