import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {updateBurial} from '../server/cemeteryBurialMutations.mjs';
import {validateBurialPayload} from '../server/routes/cemeteryRouteValidation.mjs';
const unit='Company E, 136th Pennsylvania Infantry Regiment';
test('military unit round-trips, preserves legacy updates, clears explicitly and respects cemetery scope',async()=>{
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const client=new pg.Client(integrationAdminDatabase(config));await client.connect();
 try{
  await client.query('BEGIN');
  if(!(await client.query("SELECT 1 FROM information_schema.columns WHERE table_name='burials' AND column_name='military_unit'")).rows.length)
   await client.query(await readFile(new URL('../db/changelog/changes/510-burial-military-unit.sql',import.meta.url),'utf8'));
  const {rows:[record]}=await client.query(`INSERT INTO burials(gravesite_uuid,gravesite_id,first_name,last_name,full_name,interment_type_id,burial_record_status_type_id,veteran)
   SELECT b.gravesite_uuid,b.gravesite_id,'Unit','Fixture','Unit Fixture',b.interment_type_id,b.burial_record_status_type_id,'Yes'
   FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid WHERE b.deleted_at IS NULL AND g.deleted_at IS NULL LIMIT 1 RETURNING id::text`);
  assert.ok(record,'A test burial is required');
  const scoped={query:(sql,values)=>client.query(sql==='BEGIN'?'SAVEPOINT military_unit':sql==='COMMIT'?'RELEASE SAVEPOINT military_unit':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT military_unit':sql,values),release(){}};
  const pool={connect:async()=>scoped};
  const payload=(extra={})=>validateBurialPayload({firstName:'Unit',lastName:'Fixture',veteran:true,intermentType:'unknown',recordStatusCode:'interred',...extra});
  assert.equal((await updateBurial(pool,record.id,payload({militaryUnit:unit}))).militaryUnit,unit);
  assert.equal((await updateBurial(pool,record.id,payload())).militaryUnit,unit);
  assert.equal(await updateBurial(pool,record.id,payload({militaryUnit:'Denied'}),{allowedCemeteryIds:[]}),undefined);
  assert.equal((await client.query('SELECT military_unit FROM burials WHERE id=$1',[record.id])).rows[0].military_unit,unit);
  assert.equal((await updateBurial(pool,record.id,payload({militaryUnit:''}))).militaryUnit,'');
  await updateBurial(pool,record.id,payload({militaryUnit:unit}));
  assert.equal((await updateBurial(pool,record.id,payload({veteran:false,militaryUnit:unit}))).militaryUnit,'');
 }finally{await client.query('ROLLBACK');await client.end();}
});
