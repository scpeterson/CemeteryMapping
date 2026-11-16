import assert from "node:assert/strict";
import test from "node:test";
import { classifyInscription, compareInspectionReadings, inspectionReadings } from "./reports/inscriptionLegibility.mjs";
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
const cemetery = "11111111-1111-4111-8111-111111111111";
const otherCemetery = "22222222-2222-4222-8222-222222222222";
const visit = (faces, inscription = "", year = 2026) => ({ id: String(year), inspectionYear: year, source: `Survey ${year}`, inscription, faces });
const face = (code, extra = {}) => ({ id: "front", label: "Front", inscription: "", ...(code === "full" ? { inscriptionStatus: "illegible", currentLegibility: "illegible" } : code === "partial" ? { currentLegibility: "partially_legible", inscription: "Name [-]" } : code === "readable" ? { inscription: "Name 1880", currentLegibility: "legible" } : {}), ...extra });

for (const [reading, expected] of [
 [face("full"), "full"], [face("partial"), "partial"], [face("readable"), "readable"], [{inscription:"Illegible family name",currentLegibility:"legible"},"readable"],
 [{inscription:" \n[ILLEGIBLE]\t"},"full"], [{inscription:"Name [illegible] 1880"},"partial"],
 [{inscription:"Name [-] 1880"},"partial"], [{inscription:"[-]"},"extent_unknown"],
 [{inscription:"[illegible lines]"},"extent_unknown"], [{inscription:"illegible"},"extent_unknown"],
 [{inscription:"[blank]"},"blank"], [{inscriptionStatus:"blank"},"blank"],
 [{inscription:"Blank family"},"readable"], [{inscription:""},"not_recorded"],
 [{inscription:"",historicalTranscriptions:[{text:"[illegible]"}]} ,"not_recorded"],
]) test(`legibility classification ${JSON.stringify(reading)} => ${expected}`,()=>{
 const before=structuredClone(reading);assert.equal(classifyInscription(reading).code,expected);assert.deepEqual(reading,before);
});

test("face comparisons distinguish improvements, worsening, unchanged and missing evidence",()=>{
 for(const [old,now,expected] of [["full","partial","Improved"],["partial","full","Worsened"],["partial","readable","Improved"],["readable","partial","Worsened"],["full","full","Same legibility category"]])
  assert.equal(compareInspectionReadings(visit([face(now)]),visit([face(old)],"",2005))[0].change,expected);
 for(const previous of [undefined,visit([face("unknown")]),visit([face("unknown",{inscriptionStatus:"blank"})]),visit([face("unknown",{inscription:"[-]"})])])
  assert.equal(compareInspectionReadings(visit([face("full")]),previous)[0].change,"Not comparable");
});

test("a changed partial transcription is not claimed to be unchanged legibility",()=>{
 const result=compareInspectionReadings(visit([face("partial",{inscription:"More recovered name [-]"})]),visit([face("partial",{inscription:"Name [-]"})]));
 assert.equal(result[0].change,"Same category; transcription changed");
});

test("faces match by ID then unique label; unrelated or ambiguous faces are never guessed",()=>{
 const current=visit([face("full",{label:"East"})]);
 assert.equal(compareInspectionReadings(current,visit([face("partial",{label:"North"})]))[0].change,"Worsened");
 assert.equal(compareInspectionReadings(current,visit([face("partial",{id:"different",label:" east "})]))[0].change,"Worsened");
 const unmatched=compareInspectionReadings(current,visit([face("partial",{id:"other",label:"Back"})]));
 assert.equal(unmatched.length,2);assert.match(unmatched[0].changeReason,/No matching previous/);assert.match(unmatched[1].changeReason,/No matching latest/);
 assert.equal(compareInspectionReadings(current,visit([face("partial",{id:"1",label:"East"}),face("partial",{id:"2",label:"East"})]))[0].change,"Not comparable");
});

test("stable face identity wins over a competing renamed-label fallback",()=>{
 const old=visit([face("partial",{id:"old",label:"Front"})]);
 const now=visit([face("full",{id:"new",label:"Front"}),face("full",{id:"old",label:"Back"})]);
 const result=compareInspectionReadings(now,old);
 assert.equal(result[0].old,undefined);assert.equal(result[1].old.id,"old");assert.equal(result[1].change,"Worsened");
});

test("combined face text and historical readings do not create duplicate or inferred observations",()=>{
 const f=face("partial");assert.equal(inspectionReadings(visit([f],f.inscription)).length,1);
 const back={...f,id:"back",label:"Back"};assert.equal(inspectionReadings(visit([f,back],`Front\n${f.inscription}\n\nBack\n${back.inscription}`)).length,2);
 assert.equal(inspectionReadings(visit([f],"Independent unassigned text")).length,2);
 assert.equal(inspectionReadings(undefined).length,0);
});

function poolWith(rows) {
 const queries=[];
 return {queries,async connect(){return {async query(sql,values){queries.push({sql,values});return {rows};},release(){}};}};
}
const user={role:"power-user",cemeteryAccess:[{cemeteryId:cemetery,role:"power-user"},{cemeteryId:otherCemetery,role:"reader"}]};
const reportId="unreadable-monument-inscriptions";
test("structured flags produce actionable face rows with both inspection sources and exact text",async()=>{
 const partial=face("partial",{id:"back",label:"Back",inscription:"  Dates [ - ]  "});
 const pool=poolWith([{marker_uuid:"match",monument:"HS-1",cemetery_id:cemetery,section:"E",inspections:[visit([face("full"),partial]),visit([face("readable"),{...partial,inscription:"Dates 1880",currentLegibility:"legible"}],"",2005)]}]);
 const result=await runReport(pool,reportId,{cemeteryId:cemetery,sectionName:"e",includePlotMarkers:"no"},user);
 assert.deepEqual(pool.queries[0].values,[[cemetery],"e"]);
 assert.match(pool.queries[0].sql,/marker_types.code/);assert.match(pool.queries[0].sql,/marker_scope_types.code/);
 assert.match(pool.queries[0].sql,/LIMIT 2/);assert.match(pool.queries[0].sql,/i.deleted_at IS NULL/);assert.match(pool.queries[0].sql,/COALESCE\(i.updated_at,i.created_at\)/);
 assert.equal(result.rows.length,2);assert.equal(result.rows[0].latest_legibility,"Fully illegible");
 assert.equal(result.rows[0].previous_legibility,"Readable / no illegibility noted");assert.equal(result.rows[0].change,"Worsened");
 assert.match(result.rows[0].previous_inspection,/2005.*Survey 2005/);assert.equal(result.rows[1].inscription,partial.inscription);
 assert.equal(result.rows[0].monumentRecord.id,"match");assert.equal(result.rows[0].gravesites,"Standalone marker");
});

test("history view includes recovered or missing faces while current and extent filters stay precise",async()=>{
 const rows=[{marker_uuid:"recovered",inspections:[visit([face("readable")]),visit([face("full")],"",2005)]},
  {marker_uuid:"full",inspections:[visit([face("full")])]}, {marker_uuid:"partial",inspections:[visit([face("partial")])]},
  {marker_uuid:"missing",inspections:[visit([]),visit([face("full")],"",2005)]}];
 const run=async legibility=>runReport(poolWith(rows),reportId,{legibility},user);
 assert.deepEqual((await run("")).rows.map(row=>row.marker_uuid),["full","partial"]);
 assert.deepEqual((await run("full")).rows.map(row=>row.marker_uuid),["full"]);
 assert.deepEqual((await run("partial")).rows.map(row=>row.marker_uuid),["partial"]);
 const history=(await run("history")).rows;assert.equal(history.length,4);assert.equal(history[0].change,"Improved");assert.match(history[3].change,/No matching latest/);
});

test("cemetery selection narrows authorized scope and invalid report filters are rejected",async()=>{
 const pool=poolWith([]);await runReport(pool,reportId,{cemeteryId:otherCemetery},user);assert.deepEqual(pool.queries[0].values,[]);assert.match(pool.queries[0].sql,/AND false/);
 for(const parameters of [{cemeteryId:"bad"},{legibility:"bad"},{includePlotMarkers:"bad"}]) await assert.rejects(runReport(pool,reportId,parameters,user),{code:"REPORT_PARAMETER_INVALID"});
 const all=poolWith([]);await runReport(all,reportId,{},user);assert.deepEqual(all.queries[0].values,[[cemetery]]);
 const selected=poolWith([]);await runReport(selected,reportId,{cemeteryId:otherCemetery},{role:"admin"});assert.deepEqual(selected.queries[0].values,[[otherCemetery]]);
 assert.equal(matchReportQuery("Which monuments have illegible inscriptions in section C without plot markers?").parameters.includePlotMarkers,"no");
});
