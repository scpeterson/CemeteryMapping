import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';

const migration=await readFile(new URL('../db/changelog/changes/496-retire-defunct-section-d-temporary-lots.sql',import.meta.url),'utf8');
const ids=['TMP03','TMP04','TMP05','TMP06','TMP07','TMP08','TMP09','TMP10','TMP11','TMP12','TMP15','TMP16','TMP17'];
const dependencies=['gravesites','lot_ownership_events','ownership_event_rights','historic_lot_map_gravesite_evidence','lot_restricted_areas'];
async function fixture(run){
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 try{
  await c.query('BEGIN');
  await c.query('CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP');
  for(const table of dependencies)await c.query(`CREATE TEMP TABLE ${table}(lot_uuid uuid,payload text) ON COMMIT DROP`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,name,burial_use_status,geometry)
   SELECT '00000000-0000-4000-8000-000000000001','1','D','TMP'||lpad(n::text,2,'0'),'D-TEMP-'||lpad(n::text,2,'0'),
   CASE WHEN n IN(13,14) THEN 'standard' ELSE 'non_burial' END,
   ST_Multi(ST_MakeEnvelope(-80.08,40.60,-80.0799,40.6001,4326)) FROM generate_series(1,17) n`);
  await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,block_id,lot_id,geometry)
   SELECT cemetery_id,scope.facility,scope.section,scope.block,lot_id,geometry FROM lots
   CROSS JOIN(VALUES('2','D',NULL),('1','C',NULL),('1','D','X')) scope(facility,section,block) WHERE lot_id='TMP03'`);
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}

test('retirement changes only thirteen target deletion fields, retaining other temporary lots and all geometry/history',()=>fixture(async c=>{
 await c.query('CREATE TEMP TABLE before_lots AS SELECT * FROM lots');
 // Unrelated dependencies must survive unchanged and must not block this correction.
 for(const table of dependencies)await c.query(`INSERT INTO ${table} SELECT id,'retain me' FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL AND lot_id='TMP01'`);
 await c.query(migration);
 const retired=(await c.query('SELECT lot_id,delete_reason,deleted_by FROM lots WHERE deleted_at IS NOT NULL ORDER BY lot_id')).rows;
 assert.deepEqual(retired.map(r=>r.lot_id),ids);
 assert.ok(retired.every(r=>r.deleted_by===null&&r.delete_reason.includes('older maps')));
 assert.equal((await c.query(`SELECT bool_and((to_jsonb(l)-ARRAY['deleted_at','deleted_by','delete_reason','updated_at'])=(to_jsonb(b)-ARRAY['deleted_at','deleted_by','delete_reason','updated_at'])) preserved FROM lots l JOIN before_lots b USING(id)`)).rows[0].preserved,true);
 assert.equal((await c.query(`SELECT bool_and(to_jsonb(l)=to_jsonb(b)) preserved FROM lots l JOIN before_lots b USING(id) WHERE l.deleted_at IS NULL`)).rows[0].preserved,true);
 for(const table of dependencies)assert.deepEqual((await c.query(`SELECT payload FROM ${table}`)).rows,[{payload:'retain me'}]);
}));
for(const table of dependencies)test(`retirement refuses ${table} dependencies without deleting records`,()=>fixture(async c=>{
 await c.query(`INSERT INTO ${table} SELECT id,'protected' FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL AND lot_id='TMP03'`);
 await c.query('SAVEPOINT correction');
 await assert.rejects(c.query(migration),/must have no.*dependencies/);
 await c.query('ROLLBACK TO SAVEPOINT correction');
 assert.equal((await c.query('SELECT count(*) FROM lots WHERE deleted_at IS NOT NULL')).rows[0].count,'0');
 assert.deepEqual((await c.query(`SELECT payload FROM ${table}`)).rows,[{payload:'protected'}]);
}));
for(const [name,sql,pattern] of [
 ['missing target',"DELETE FROM lots WHERE lot_id='TMP03' AND facility_id='1' AND section_id='D' AND block_id IS NULL",/all thirteen/],
 ['already retired target',"UPDATE lots SET deleted_at=now() WHERE lot_id='TMP03' AND facility_id='1' AND section_id='D' AND block_id IS NULL",/all thirteen/],
 ['burial-enabled target',"UPDATE lots SET burial_use_status='standard' WHERE lot_id='TMP03' AND facility_id='1' AND section_id='D' AND block_id IS NULL",/non-burial/],
 ['wrong cemetery',"UPDATE lots SET cemetery_id='00000000-0000-4000-8000-000000000002' WHERE lot_id='TMP03' AND facility_id='1' AND section_id='D' AND block_id IS NULL",/one cemetery/],
])test(`retirement refuses ${name}`,()=>fixture(async c=>{
 await c.query(sql);await assert.rejects(c.query(migration),pattern);
}));
test('retirement skips databases without active Trinity Section D lots',()=>fixture(async c=>{
 await c.query("DELETE FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL");
 const before=(await c.query('SELECT to_jsonb(l) record FROM lots l ORDER BY id')).rows;
 await c.query(migration);
 assert.deepEqual((await c.query('SELECT to_jsonb(l) record FROM lots l ORDER BY id')).rows,before);
}));
