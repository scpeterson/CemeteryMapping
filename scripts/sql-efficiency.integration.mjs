import { listRecordOptions } from "../server/recordOptions.mjs";
import { listHeadstoneLookupOptions } from "../server/cemeteryLookupQueries.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { createUser, updateUser, listUsers, ensureSystemRoles } from "../server/adminRepository.mjs";
import { createInspectionFixture } from "./lib/inspection-fixtures.mjs";
import { insertValueRows } from "./lib/insert-value-rows.mjs";
import { importEntries, parseNorthHillsOcrText } from "./db-import-north-hills-ocr.mjs";
import { insertRegistryEntries, parseRegistryRow } from "./db-import-deed-registry-xlsx.mjs";

async function fixture(run) {
  const client = new pg.Client(integrationAdminDatabase(loadApiConfig()));
  await client.connect();
  try { await client.query("BEGIN"); await run(client); }
  finally { await client.query("ROLLBACK"); await client.end(); }
}

function transactionalPool(client) {
  const query = (sql, p) => client.query(sql === "BEGIN" ? "SAVEPOINT repository" : sql === "COMMIT" ? "RELEASE SAVEPOINT repository" : sql === "ROLLBACK" ? "ROLLBACK TO SAVEPOINT repository" : sql, p);
  return { query, connect: async () => ({ query, release() {} }) };
}

test("unchanged users and memberships retain identities/timestamps and do not add audit rows", () => fixture(async c => {
  const cemeteries = (await c.query("SELECT id FROM cemeteries WHERE deleted_at IS NULL ORDER BY id LIMIT 2")).rows.map(r => r.id);
  const pool = transactionalPool(c);
  const input = { externalSubject: `perf|${randomUUID()}`, email: `perf-${randomUUID()}@example.test`, displayName: "Directory fixture", role: "cemetery-admin", isActive: true, assignedCemeteryIds: cemeteries, cemeteryMemberships: cemeteries.map(cemeteryId => ({ cemeteryId, role: "reader" })) };
  const user = await createUser(pool, input);
  const membershipRows = () => c.query("SELECT * FROM app_user_cemetery_access WHERE app_user_id=$1 ORDER BY cemetery_id", [user.id]);
  const before = (await membershipRows()).rows;
  const audit = (await c.query("SELECT count(*)::int AS n FROM audit_events")).rows[0].n;
  await updateUser(pool, user.id, input);
  assert.deepEqual((await membershipRows()).rows, before);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM audit_events")).rows[0].n, audit);
  const changed = { ...input, assignedCemeteryIds: [cemeteries[0]], cemeteryMemberships: [{ cemeteryId: cemeteries[0], role: "power-user" }] };
  await updateUser(pool, user.id, changed);
  const after = (await membershipRows()).rows;
  assert.equal(after.length, 1); assert.equal(after[0].id, before[0].id); assert.equal(after[0].role_name, "power-user");
  await ensureSystemRoles(c);
  const roles = (await c.query("SELECT ctid::text,* FROM app_roles ORDER BY role_name")).rows;
  await ensureSystemRoles(c);
  assert.deepEqual((await c.query("SELECT ctid::text,* FROM app_roles ORDER BY role_name")).rows, roles);
  assert.equal((await listUsers(c, { email: input.email })).length, 1);
  assert.equal((await listUsers(c, { email: input.email, status: "inactive" })).length, 0);
  assert.equal((await listUsers(c, { email: input.email, cemeteryId: cemeteries[1] })).length, 0);
  const first = await listUsers(c, { q: "Directory fixture", limit: 1, offset: 0 });
  assert.equal(first[0].id, user.id);
  assert.equal((await listUsers(c, { q: "Directory fixture", limit: 1, offset: 1 })).length, 0);
}));

test("unchanged NHG evidence and field saves do not rewrite inspections or their audit history", () => fixture(async c => {
  const { id, entryId } = await createInspectionFixture(c);
  const rows = () => c.query("SELECT ctid::text,* FROM monument_inspections WHERE headstone_uuid=$1 ORDER BY id", [id]);
  const before = (await rows()).rows;
  const audit = (await c.query("SELECT count(*)::int AS n FROM audit_events WHERE target_table='monument_inspections'")).rows[0].n;
  await c.query("SELECT refresh_nhg_inspection($1)", [id]);
  await c.query("UPDATE headstones SET condition_notes=condition_notes WHERE id=$1", [id]);
  await c.query("UPDATE north_hills_ocr_entries SET raw_text=raw_text WHERE id=$1", [entryId]);
  await c.query("UPDATE north_hills_ocr_entry_headstone_links SET notes='Review metadata only' WHERE entry_id=$1 AND headstone_uuid=$2", [entryId,id]);
  assert.deepEqual((await rows()).rows, before);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM audit_events WHERE target_table='monument_inspections'")).rows[0].n, audit);
  await c.query("UPDATE north_hills_ocr_entries SET inscription_text='A new source reading' WHERE id=$1", [entryId]);
  assert.equal((await c.query("SELECT inscription FROM monument_inspections WHERE headstone_uuid=$1 AND origin_key='nhg'", [id])).rows[0].inscription, "A new source reading");
}));

test("bounded staging imports preserve UUID relationships, parsed arrays, source facts and allocation counts", () => fixture(async c => {
  const cemetery = (await c.query("SELECT id FROM cemeteries WHERE deleted_at IS NULL LIMIT 1")).rows[0];
  const entries = parseNorthHillsOcrText('Section A, Row 1\nSMITH (1A, 1, s) upright, granite, good cond "John Smith / 1900-1980" CR: d. January 2, 1980.\nFranklin Park Borough 183 Allegheny County, PA');
  assert.ok(entries.length);
  // Cross the default 250-row boundary; unique source line numbers retain source identity.
  const many = Array.from({ length: 251 }, (_, i) => ({ ...entries[0], sourcePageIndex: 1, sourceLineStart: i + 1, sourceLineEnd: i + 1, rawText: 'SMITH / CR: d. January 2, 1980.' }));
  const batch = await importEntries(c, cemetery, '/fixture/source.txt', {}, many);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM north_hills_ocr_entries WHERE batch_id=$1", [batch])).rows[0].n, 251);
  const facts = (await c.query("SELECT count(*)::int AS n FROM north_hills_ocr_source_facts f JOIN north_hills_ocr_entries e ON e.id=f.entry_id WHERE e.batch_id=$1", [batch])).rows[0].n;
  assert.ok(facts >= 251);
  assert.equal((await c.query("SELECT count(DISTINCT f.entry_id)::int AS n FROM north_hills_ocr_source_facts f JOIN north_hills_ocr_entries e ON e.id=f.entry_id WHERE e.batch_id=$1", [batch])).rows[0].n, 251);
  const registry = (await c.query("INSERT INTO deed_registry_import_batches(cemetery_id,source_name,source_path,worksheet_name) VALUES($1,'Fixture','/fixture','Fixture') RETURNING id", [cemetery.id])).rows[0].id;
  const rows = Array.from({ length: 251 }, (_, i) => ({ rowNumber: i + 1, lastName: `Person ${i}`, firstName: 'Test', lot: 'G - 47-49', section: '', remarks: '', modernSection: 'G' }));
  const count = await insertRegistryEntries(c, registry, cemetery.id, rows.map(row => ({ row, parsed: parseRegistryRow(row) })));
  assert.equal(count, 753);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM deed_registry_entry_allocations a JOIN deed_registry_entries e ON e.id=a.entry_id WHERE e.batch_id=$1", [registry])).rows[0].n, 753);
}));

test("failed bulk imports remain atomic and diagnostics are unavailable to the API role", () => fixture(async c => {
  await c.query("CREATE TEMP TABLE batch_probe(id integer PRIMARY KEY,label text)");
  await c.query("SAVEPOINT import_attempt");
  await assert.rejects(insertValueRows(c, "INSERT INTO batch_probe(id,label)", [[1,'first'],[1,'duplicate']], { maxRows: 1 }), { code: "23505" });
  await c.query("ROLLBACK TO SAVEPOINT import_attempt");
  assert.equal((await c.query("SELECT count(*)::int AS n FROM batch_probe")).rows[0].n, 0);
  assert.equal((await c.query("SELECT has_schema_privilege('cemetery_api','diagnostics','USAGE') AS allowed")).rows[0].allowed, false);
  await c.query("SET LOCAL ROLE cemetery_api");
  await assert.rejects(c.query("SELECT * FROM diagnostics.pg_stat_statements LIMIT 1"), { code: "42501" });
}));


test("reference-only loading omits entity scans and record options are bounded and scoped", () => fixture(async c => {
  let queries=0;
  const pool={connect:async()=>({query:(...args)=>{queries++;return c.query(...args);},release(){}})};
  const refs=await listHeadstoneLookupOptions(pool,{includeEntities:false,allowedCemeteryIds:[]});
  assert.equal(queries,1);assert.deepEqual(refs.headstones,[]);assert.deepEqual(refs.gravesites,[]);
  assert.ok(refs.markerTypes.length);
  const cem=(await c.query("SELECT cemetery_id FROM gravesites WHERE deleted_at IS NULL GROUP BY cemetery_id ORDER BY count(*) DESC LIMIT 1")).rows[0].cemetery_id;
  const first=await listRecordOptions(c,"gravesites",{allowedCemeteryIds:[cem],limit:1});
  const second=await listRecordOptions(c,"gravesites",{allowedCemeteryIds:[cem],limit:1,offset:1});
  assert.equal(first.length,1);assert.equal(second.length,1);assert.notEqual(first[0].id,second[0].id);
  assert.deepEqual(await listRecordOptions(c,"gravesites",{allowedCemeteryIds:[]}),[]);
  assert.deepEqual(await listRecordOptions(c,"gravesites",{query:"nonexistent-fixture-12345"}),[]);
}));
