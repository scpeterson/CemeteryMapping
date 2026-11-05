import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {beginFieldOperation,completeFieldOperation,fieldRequestHash} from '../server/fieldOperationReceipts.mjs';

test('concurrent lost-response retries commit exactly once; mismatched content and rollback cannot reuse success',async()=>{
  const config=integrationAdminDatabase(loadApiConfig()),admin=new pg.Client(config);await admin.connect();
  const schema=`field_receipts_${randomUUID().replaceAll('-','')}`;let pool;
  try{
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`CREATE TABLE ${schema}.field_operations (LIKE public.field_operations INCLUDING ALL)`);
    await admin.query(`CREATE TABLE ${schema}.writes(id uuid)`);
    pool=new pg.Pool({...config,max:3,options:`-c search_path=${schema},public`});
    const actor={subject:'fixture|offline'},id=randomUUID(),hash=fieldRequestHash({photoBytes:'original',notes:'evidence'});
    async function attempt(operationId=id,requestHash=hash,fail=false){
      const client=await pool.connect();try{
        await client.query('BEGIN');const receipt=await beginFieldOperation(client,actor,operationId,requestHash);
        if(!receipt.replayed){await client.query('INSERT INTO writes VALUES($1)',[operationId]);if(fail)throw new Error('fixture rollback');await completeFieldOperation(client,actor,operationId,{id:operationId});}
        await client.query('COMMIT');return receipt;
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    const results=await Promise.all([attempt(),attempt(),attempt()]);
    assert.equal(results.filter(r=>!r.replayed).length,1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM writes')).rows[0].n,1);
    await assert.rejects(()=>attempt(id,fieldRequestHash({photoBytes:'different'})),{name:'ConflictError'});
    const failed=randomUUID();await assert.rejects(()=>attempt(failed,hash,true),/rollback/);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM field_operations WHERE operation_id=$1',[failed])).rows[0].n,0);
    assert.equal((await attempt(failed)).replayed,false);
  }finally{if(pool)await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});

test('photo replay retains one original file and refuses different bytes or revoked scope',async()=>{
  const {mkdtemp,readdir,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const {createInspectionFixture}=await import('./lib/inspection-fixtures.mjs');const {createHeadstonePhoto}=await import('../server/mediaRepository.mjs');const {fieldTransactionPool}=await import('../server/fieldOperationReceipts.mjs');
  const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();const uploadRoot=await mkdtemp(join(tmpdir(),'field-photo-'));
  try{
    await client.query('BEGIN');const {id}=await createInspectionFixture(client);const pool=fieldTransactionPool(client);
    const actorUser={subject:'fixture|photo',role:'admin'},metadata={operationId:randomUUID(),notes:'original evidence'};
    const file={bytes:Buffer.from('original photo file'),contentType:'image/png',originalFilename:'field.png'};
    const first=await createHeadstonePhoto(pool,id,file,metadata,{actorUser,uploadRoot});const second=await createHeadstonePhoto(pool,id,file,metadata,{actorUser,uploadRoot});
    assert.equal(second.id,first.id);assert.equal((await readdir(uploadRoot)).filter(n=>!n.startsWith('.')).length,1);
    await assert.rejects(()=>createHeadstonePhoto(pool,id,{...file,bytes:Buffer.from('different')},metadata,{actorUser,uploadRoot}),{name:'ConflictError'});
    assert.equal(await createHeadstonePhoto(pool,id,file,metadata,{actorUser,uploadRoot,allowedCemeteryIds:[]}),undefined);
  }finally{await client.query('ROLLBACK');await client.end();await rm(uploadRoot,{recursive:true,force:true});}
});

test('field snapshots and actual marker synchronization preserve scope, versions and receipts',async()=>{
  const {createInspectionFixture}=await import('./lib/inspection-fixtures.mjs');const {fieldTransactionPool}=await import('../server/fieldOperationReceipts.mjs');
  const {getFieldSnapshot,synchronizeFieldOperation,validateFieldOperation,listFieldMarkers}=await import('../server/fieldCollectionRepository.mjs');
  const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
  try{
    await client.query('BEGIN');const {id}=await createInspectionFixture(client);const pool=fieldTransactionPool(client);
    const cemeteryId=(await client.query('SELECT g.cemetery_id FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid WHERE h.id=$1',[id])).rows[0].cemetery_id;
    // Snapshot owns its read-only transaction; borrow this fixture transaction
    // without changing its isolation or ending the rollback-only test.
    const reader={query:client.query.bind(client),connect:async()=>({release(){},query(sql,params){if(sql.startsWith('BEGIN ISOLATION'))return client.query('SAVEPOINT snapshot');if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT snapshot');if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT snapshot');return client.query(sql,params);}})};
    const snapshot=await getFieldSnapshot(reader,cemeteryId,id);assert.equal(snapshot.headstone.id,id);assert.equal(snapshot.owners,undefined);
    assert.ok((await listFieldMarkers(pool,cemeteryId,{query:snapshot.headstone.headstoneId})).some(r=>r.id===id));
    assert.equal(await getFieldSnapshot(reader,randomUUID(),id),undefined);
    const h=snapshot.headstone;
    const operation=validateFieldOperation({id:randomUUID(),cemeteryId,targetId:id,kind:'marker',payload:{markerTypeId:h.markerType.id,markerScopeId:h.markerScope.id,materialId:h.material.id,conditionId:h.condition.id,expectedVersion:h.version,designNotes:'Field change'}});
    assert.equal((await synchronizeFieldOperation(pool,operation,{role:'reader',subject:'fixture|field'})).forbidden,true);
    const first=await synchronizeFieldOperation(pool,operation,{role:'admin',subject:'fixture|field'});assert.equal(first.replayed,false);
    const retry=await synchronizeFieldOperation(pool,operation,{role:'admin',subject:'fixture|field'});assert.equal(retry.replayed,true);
    assert.equal((await client.query('SELECT design_notes FROM headstones WHERE id=$1',[id])).rows[0].design_notes,'Field change');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM field_operations WHERE operation_id=$1',[operation.id])).rows[0].n,1);
  }finally{await client.query('ROLLBACK');await client.end();}
});

test('nested borrowed transaction failures roll back the enclosing receipt without shadowing savepoints',async()=>{
 const {withAuditContext}=await import('../server/auditContext.mjs');const {fieldTransactionPool}=await import('../server/fieldOperationReceipts.mjs');
 const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
 try{
  await client.query('BEGIN');const actor={role:'admin',subject:'fixture|nested-rollback'},id=randomUUID(),pool=fieldTransactionPool(client);
  await assert.rejects(()=>withAuditContext(pool,{actorUser:actor},async outer=>{
   await beginFieldOperation(outer,actor,id,fieldRequestHash({kind:'nested-fixture'}));
   await withAuditContext(fieldTransactionPool(outer),{actorUser:actor},async()=>{throw new Error('Nested work failed');});
  }),/Nested work failed/);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM field_operations WHERE operation_id=$1',[id])).rows[0].n,0);
  assert.equal((await client.query('SELECT 1 AS still_usable')).rows[0].still_usable,1);
 }finally{await client.query('ROLLBACK');await client.end();}
});
