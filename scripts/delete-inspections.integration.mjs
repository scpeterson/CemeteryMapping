import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {loadDbEnvironment} from './lib/run-liquibase.mjs';
import {createInspectionFixture} from './lib/inspection-fixtures.mjs';
import {updateHeadstone} from '../server/cemeteryHeadstoneMutations.mjs';
import {validateDeletedInspections} from '../server/monumentInspections.mjs';

test('inspection deletion enforces roles, cemetery scope and versions, preserves photos and prevents source recreation',async()=>{
 const env=loadDbEnvironment('test');
 const c=new pg.Client({host:'127.0.0.1',port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD});
 await c.connect();
 try {
  await c.query('BEGIN');
  if (!(await c.query("SELECT 1 FROM information_schema.columns WHERE table_name='monument_inspections' AND column_name='deleted_at'")).rowCount) await c.query(await readFile(new URL('../db/changelog/changes/494-delete-monument-inspections.sql',import.meta.url),'utf8'));
  const {id}=await createInspectionFixture(c);
  const pool={connect:async()=>({release(){},query:(sql,params)=>c.query(sql==='BEGIN'?'SAVEPOINT deletion':sql==='COMMIT'?'RELEASE SAVEPOINT deletion':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT deletion':sql,params)})};
  const inspections=(await c.query('SELECT id,updated_at::text AS version FROM monument_inspections WHERE headstone_uuid=$1',[id])).rows;
  for(const inspection of inspections) {
   const payload={inspectionChangesOnly:true,deletedInspections:validateDeletedInspections([{id:inspection.id,expectedUpdatedAt:inspection.version}])};
   for(const role of ['reader','power-user']) await assert.rejects(updateHeadstone(pool,id,payload,{actorUser:{role}}),{statusCode:403});
   assert.equal(await updateHeadstone(pool,id,payload,{actorUser:{role:'cemetery-admin'},allowedCemeteryIds:[]}),undefined);
   await assert.rejects(updateHeadstone(pool,id,{...payload,deletedInspections:[{id:inspection.id,expectedUpdatedAt:'2000-01-01'}]},{actorUser:{role:'admin'}}),/changed or was deleted/);
   const result=await updateHeadstone(pool,id,payload,{actorUser:{role:'cemetery-admin'}});
   assert.ok(!result.inspections.some(i=>i.id===inspection.id));
   await assert.rejects(updateHeadstone(pool,id,payload,{actorUser:{role:'admin'}}),/changed or was deleted/);
  }
  await c.query('SELECT refresh_nhg_inspection($1)',[id]);
  await c.query("UPDATE headstones SET condition_notes='Refresh trigger regression' WHERE id=$1",[id]);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM monument_inspections WHERE headstone_uuid=$1 AND deleted_at IS NULL',[id])).rows[0].n,0);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM monument_photo_contexts WHERE headstone_uuid=$1 AND deleted_at IS NULL',[id])).rows[0].n,0);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM headstone_media_assets WHERE headstone_uuid=$1 AND deleted_at IS NULL',[id])).rows[0].n,2);
 } finally {await c.query('ROLLBACK');await c.end();}
});
