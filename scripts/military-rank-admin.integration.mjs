import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { createLookupRecord, updateLookupRecord, listLookupRecords } from "../server/lookupAdminRepository.mjs";

async function fixture(run) {
  const c = new pg.Client(integrationAdminDatabase(loadApiConfig()));
  await c.connect();
  try {
    await c.query("BEGIN");
    for (const table of ["military_branch_types", "military_rank_types", "burials"]) {
      await c.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    await c.query("ALTER TABLE military_rank_types ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''");
    const { rows: branches } = await c.query(`INSERT INTO military_branch_types(code,label,description,sort_order)
      VALUES('army','Army','Army',1),('navy','Navy','Navy',2) RETURNING id,code`);
    // Keep repository transactions within the outer rollback-only fixture.
    const pool = { connect: async () => ({
      query: (sql, values) => c.query(sql === "BEGIN" ? "SAVEPOINT rank_edit" : sql === "COMMIT" ? "RELEASE SAVEPOINT rank_edit" : sql === "ROLLBACK" ? "ROLLBACK TO SAVEPOINT rank_edit" : sql, values),
      release() {},
    }) };
    await run(c, pool, branches);
  } finally { await c.query("ROLLBACK"); await c.end(); }
}

test("rank create, list and edit round-trip branch details and retain inactive rank history", async () => {
  await fixture(async (c, pool, branches) => {
    const input = {code:"custom_t4",label:"Technician Fourth Grade",description:"Historical Army rank",militaryBranchId:branches[0].id,abbreviation:"Tec 4",payGrade:"4th Grade",rankGroup:"enlisted",isActive:true};
    const created = await createLookupRecord(pool,"military_rank_types",input);
    assert.equal(created.militaryBranchId,input.militaryBranchId);
    assert.equal(created.abbreviation,"Tec 4");
    assert.equal(created.payGrade,"4th Grade");
    await c.query(`INSERT INTO burials(gravesite_uuid,full_name,interment_type_id,burial_record_status_type_id,military_rank_type_id)
      VALUES(gen_random_uuid(),'Example Veteran',gen_random_uuid(),gen_random_uuid(),$1)`,[created.id]);
    const listed = (await listLookupRecords(pool)).lookups.military_rank_types;
    assert.equal(listed[0].usageCount,1);
    const saved = await updateLookupRecord(pool,"military_rank_types",created.id,{...input,label:"Technician, fourth grade",abbreviation:"T/4",isActive:false});
    assert.equal(saved.isActive,false);
    assert.equal(saved.abbreviation,"T/4");
    assert.equal(saved.usageCount,1);
    assert.equal((await c.query("SELECT military_rank_type_id FROM burials")).rows[0].military_rank_type_id,created.id);
    await assert.rejects(updateLookupRecord(pool,"military_rank_types",created.id,{...input,militaryBranchId:branches[1].id}),/branch cannot be changed/);
    // Same code is legal in a different branch, but never twice in one branch.
    await createLookupRecord(pool,"military_rank_types",{...input,militaryBranchId:branches[1].id});
    await assert.rejects(createLookupRecord(pool,"military_rank_types",input),/already exists/);
    await c.query("UPDATE military_branch_types SET is_active=false WHERE id=$1",[branches[1].id]);
    await assert.rejects(createLookupRecord(pool,"military_rank_types",{...input,code:"other",militaryBranchId:branches[1].id}),/active military branch/);
  });
});

test("Tec 4 migration seeds the Army historical fourth pay grade",async()=>{
  await fixture(async(c)=>{
    await c.query("ALTER TABLE military_rank_types DROP COLUMN description");
    const migration = await readFile(new URL("../db/changelog/changes/455-admin-military-ranks-and-tec4.sql",import.meta.url),"utf8");
    await c.query(migration);
    const {rows}=await c.query("SELECT r.abbreviation,r.pay_grade,r.rank_group,r.is_active FROM military_rank_types r JOIN military_branch_types b ON b.id=r.military_branch_type_id WHERE b.code='army' AND r.code='tec4'");
    assert.deepEqual(rows,[{abbreviation:"Tec 4",pay_grade:"4th Grade",rank_group:"enlisted",is_active:true}]);
  });
});
