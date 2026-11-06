import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {fieldTransactionPool} from '../server/fieldOperationReceipts.mjs';
import {createOnboardingCemetery,stageImport,decideImport,getImportBatch,listImportBatches} from '../server/cemeteryOnboardingRepository.mjs';

test('onboarding stages source without live changes, validates geometry/duplicates, and atomically promotes reviewed records',async()=>{
 const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
 try{
  await client.query('BEGIN');const pool=fieldTransactionPool(client),actor={role:'admin',subject:'fixture|onboarding'};
  const polygon=(x,y,size)=>({type:'Polygon',coordinates:[[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]]});
  const cemetery=await createOnboardingCemetery(pool,{name:`Onboarding ${randomUUID()}`,municipality:'Fixture',geometry:polygon(-80,40,.01),reason:'Integration fixture'},actor);
  const prefix=randomUUID().slice(0,8),gravesiteId=`IMPORT-${prefix}`;
  const sourceText=JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{gravesiteId,graveId:'1'},geometry:polygon(-79.999,40.001,.00001)}]});
  let batch=await stageImport(pool,cemetery.id,{kind:'gravesites',sourceName:'original.geojson',sourceText},actor);
  assert.equal(batch.review.errorCount,0);assert.equal((await client.query('SELECT count(*)::int AS n FROM gravesites WHERE cemetery_id=$1',[cemetery.id])).rows[0].n,0);
  assert.equal((await listImportBatches(pool,cemetery.id))[0].review.rows.length,0,'directory omits detailed source rows');
  assert.equal((await client.query('SELECT source_text FROM cemetery_import_batches WHERE id=$1',[batch.id])).rows[0].source_text,sourceText);
  await assert.rejects(()=>decideImport(pool,cemetery.id,batch.id,{decision:'approve',reason:'Review',expectedVersion:'999999999'},actor),{name:'ConflictError'});
  batch=await decideImport(pool,cemetery.id,batch.id,{decision:'approve',reason:'Boundary and source reviewed',expectedVersion:batch.version},actor);
  assert.equal(batch.status,'approved');assert.equal(batch.createdRecords.length,1);
  await assert.rejects(()=>decideImport(pool,cemetery.id,batch.id,{decision:'approve',reason:'Retry',expectedVersion:batch.version},actor),{name:'ConflictError'});
  const duplicate=await stageImport(pool,cemetery.id,{kind:'gravesites',sourceName:'duplicate.geojson',sourceText},actor);assert.equal(duplicate.review.errorCount,1);
  await assert.rejects(()=>decideImport(pool,cemetery.id,duplicate.id,{decision:'approve',reason:'Invalid',expectedVersion:duplicate.version},actor),{name:'ConflictError'});
  const outside=await stageImport(pool,cemetery.id,{kind:'gravesites',sourceName:'outside.geojson',sourceText:JSON.stringify({type:'FeatureCollection',features:[{properties:{gravesiteId:`OUT-${prefix}`,graveId:'2'},geometry:polygon(0,0,.1)}]})},actor);assert.match(outside.review.rows[0].errors.join(),/outside/);
  const malformed=await stageImport(pool,cemetery.id,{kind:'gravesites',sourceName:'bad.geojson',sourceText:JSON.stringify({type:'FeatureCollection',features:[{properties:{gravesiteId:`BAD-${prefix}`,graveId:'3'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,1]]]}}]})},actor);assert.equal(malformed.review.errorCount,1,'spatial parse failure becomes a review error without poisoning transaction');
  const people=await stageImport(pool,cemetery.id,{kind:'burials',sourceName:'people.csv',sourceText:`gravesiteId,firstName,lastName,birthDate,deathDate,notes\n${gravesiteId},Alice,Example,1901,1981,"Original, evidence"`},actor);assert.equal(people.review.errorCount,0);
  const approved=await decideImport(pool,cemetery.id,people.id,{decision:'approve',reason:'Source checked',expectedVersion:people.version},actor);assert.equal(approved.createdRecords.length,1);
  const burial=(await client.query('SELECT first_name,notes,birth_date_text FROM burials WHERE id=$1',[approved.createdRecords[0].id])).rows[0];assert.equal(burial.first_name,'Alice');assert.equal(burial.notes,'Original, evidence');assert.equal(burial.birth_date_text,'1901');
  const duplicatePeople=await stageImport(pool,cemetery.id,{kind:'burials',sourceName:'again.csv',sourceText:`gravesiteId,firstName,lastName\n${gravesiteId},Alice,Example`},actor);assert.equal(duplicatePeople.review.errorCount,1);
  assert.equal(await getImportBatch(pool,randomUUID(),people.id),undefined);
  assert.ok((await client.query("SELECT 1 FROM audit_events WHERE target_table='cemetery_import_batches' AND target_record_id=$1",[people.id])).rowCount);
 }finally{await client.query('ROLLBACK');await client.end();}
});
