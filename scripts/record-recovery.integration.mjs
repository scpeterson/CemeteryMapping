import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {fieldTransactionPool} from '../server/fieldOperationReceipts.mjs';
import {recoveryKinds,listDeletedRecords,restoreDeletedRecord} from '../server/recordRecoveryRepository.mjs';
import {previewBurialMerge,mergeBurials} from '../server/burialMergeRepository.mjs';
import {createInspectionFixture} from './lib/inspection-fixtures.mjs';

test('scoped recovery, same-grave person merge and preserved relationship/evidence history',async()=>{
 const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
 try{
  await client.query('BEGIN');const pool=fieldTransactionPool(client),actor={role:'admin',subject:'fixture|recovery'};
  const {id:markerId}=await createInspectionFixture(client);
  const grave=(await client.query('SELECT g.id,g.cemetery_id FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid WHERE h.id=$1',[markerId])).rows[0];
  for(const kind of recoveryKinds)await listDeletedRecords(pool,grave.cemetery_id,kind,{limit:1});
  const sourceId=randomUUID(),targetId=randomUUID();
  for(const [id,name]of [[sourceId,'Donor'],[targetId,'Survivor']])await client.query(`INSERT INTO burials(id,gravesite_uuid,first_name,last_name,full_name,notes,interment_type_id,burial_record_status_type_id)
   VALUES($1,$2,$3::text,'Example',$3::text||' Example',$3::text||' original evidence',(SELECT id FROM burial_interment_types WHERE code='unknown'),(SELECT id FROM burial_record_status_types WHERE code='interred'))`,[id,grave.id,name]);
  await client.query('INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES($1,$2),($1,$3)',[markerId,sourceId,targetId]);
  const faceId=(await client.query('SELECT faces FROM headstones WHERE id=$1',[markerId])).rows[0].faces[0].id;
  await client.query("UPDATE headstones SET faces=jsonb_set(faces,'{0,burialIds}',$2::jsonb) WHERE id=$1",[markerId,JSON.stringify([sourceId,targetId])]);
  const memorialId=(await client.query("INSERT INTO memorials(burial_uuid,memory_text) VALUES($1,'Original memory') RETURNING id",[sourceId])).rows[0].id;
  await client.query('CREATE TABLE unknown_person_reference_fixture (id uuid REFERENCES burials(id))');
  assert.ok((await previewBurialMerge(pool,grave.cemetery_id,sourceId,targetId,actor)).blockers.some(b=>b.includes('updated merge handler')));
  await client.query('DROP TABLE unknown_person_reference_fixture');
  assert.equal(await previewBurialMerge(pool,randomUUID(),sourceId,targetId,actor),undefined);
  let preview=await previewBurialMerge(pool,grave.cemetery_id,sourceId,targetId,actor);assert.deepEqual(preview.blockers,[]);
  await client.query("UPDATE memorials SET memory_text='Updated original memory' WHERE id=$1",[memorialId]);
  await assert.rejects(()=>mergeBurials(pool,grave.cemetery_id,{...preview,reason:'Duplicate reviewed',acknowledge:true},actor),{name:'ConflictError'});
  preview=await previewBurialMerge(pool,grave.cemetery_id,sourceId,targetId,actor);
  assert.equal((await client.query('SELECT burial_uuid FROM memorials WHERE id=$1',[memorialId])).rows[0].burial_uuid,sourceId,'preview rolls all trial transfers back');
  const result=await mergeBurials(pool,grave.cemetery_id,{...preview,reason:'Duplicate identity confirmed',acknowledge:true},actor);assert.equal(result.targetId,targetId);
  const source=(await client.query('SELECT * FROM burials WHERE id=$1',[sourceId])).rows[0];assert.ok(source.deleted_at);assert.equal(source.notes,'Donor original evidence');
  assert.equal((await client.query('SELECT notes FROM burials WHERE id=$1',[targetId])).rows[0].notes,'Survivor original evidence');
  const faces=(await client.query('SELECT faces FROM headstones WHERE id=$1',[markerId])).rows[0].faces;assert.equal(faces[0].id,faceId);assert.deepEqual(faces[0].burialIds,[targetId]);
  assert.equal((await client.query('SELECT burial_uuid FROM memorials WHERE id=$1',[memorialId])).rows[0].burial_uuid,targetId);
  const ledger=(await client.query('SELECT * FROM burial_record_merges WHERE source_id=$1',[sourceId])).rows[0];assert.equal(ledger.relationship_snapshot.memorials[0].record.memory_text,'Updated original memory');
  const donor=(await listDeletedRecords(pool,grave.cemetery_id,'burials',{query:sourceId}))[0];assert.equal(donor.mergedInto,targetId);
  await assert.rejects(()=>restoreDeletedRecord(pool,grave.cemetery_id,'burials',sourceId,{expectedVersion:donor.version,reason:'Unsafe undo'},actor),{name:'ConflictError'});
  await assert.rejects(()=>client.query('INSERT INTO headstone_burials(headstone_uuid,burial_uuid) SELECT id,$1 FROM headstones WHERE id<>$2 AND deleted_at IS NULL LIMIT 1',[sourceId,markerId]),/merged or deleted/);
  // Restore the savepoint after the intentional trigger failure.
 }finally{await client.query('ROLLBACK');await client.end();}
});

test('restoration requires a fresh token and active parent, and never restores unrelated children',async()=>{
 const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
 try{
  await client.query('BEGIN');const pool=fieldTransactionPool(client),actor={role:'admin',subject:'fixture|restore'},id=randomUUID();
  const grave=(await client.query('SELECT id,cemetery_id FROM gravesites WHERE deleted_at IS NULL LIMIT 1')).rows[0];
  await client.query(`INSERT INTO burials(id,gravesite_uuid,first_name,last_name,interment_type_id,burial_record_status_type_id,deleted_at,delete_reason) VALUES($1,$2,'Deleted','Person',(SELECT id FROM burial_interment_types WHERE code='unknown'),(SELECT id FROM burial_record_status_types WHERE code='interred'),now(),'Fixture deletion')`,[id,grave.id]);
  const row=(await listDeletedRecords(pool,grave.cemetery_id,'burials',{query:id}))[0];
  assert.equal(await restoreDeletedRecord(pool,randomUUID(),'burials',id,{expectedVersion:row.version,reason:'Wrong cemetery'},actor),undefined);
  await assert.rejects(()=>restoreDeletedRecord(pool,grave.cemetery_id,'burials',id,{expectedVersion:'999999999',reason:'Stale'},actor),{name:'ConflictError'});
  await client.query('SAVEPOINT deleted_parent');await client.query('UPDATE gravesites SET deleted_at=now() WHERE id=$1',[grave.id]);
  await assert.rejects(()=>restoreDeletedRecord(pool,grave.cemetery_id,'burials',id,{expectedVersion:row.version,reason:'Missing parent'},actor),{name:'ConflictError'});await client.query('ROLLBACK TO SAVEPOINT deleted_parent');
  const restored=await restoreDeletedRecord(pool,grave.cemetery_id,'burials',id,{expectedVersion:row.version,reason:'Original record reviewed'},actor);assert.equal(restored.restored,true);
  assert.equal((await client.query('SELECT deleted_at FROM burials WHERE id=$1',[id])).rows[0].deleted_at,null);
  assert.ok((await client.query("SELECT 1 FROM audit_events WHERE target_table='burials' AND target_record_id=$1 AND action='restore'",[id])).rowCount);
 }finally{await client.query('ROLLBACK');await client.end();}
});

test('photo recovery verifies original bytes exist and restores library links separately',async()=>{
 const {mkdtemp,rename,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createHeadstonePhoto,softDeleteMediaAsset}=await import('../server/mediaRepository.mjs');
 const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();const root=await mkdtemp(join(tmpdir(),'photo-recovery-'));
 try{
  await client.query('BEGIN');const pool=fieldTransactionPool(client),actor={role:'admin',subject:'fixture|photo-restore'},fixture=await createInspectionFixture(client);
  const photo=await createHeadstonePhoto(pool,fixture.id,{bytes:Buffer.from('retained original'),contentType:'image/png',originalFilename:'original.png'},{},{actorUser:actor,uploadRoot:root});
  const asset=(await client.query('SELECT cemetery_id,storage_key FROM media_assets WHERE id=$1',[photo.id])).rows[0];
  await softDeleteMediaAsset(pool,photo.id,{actorUser:actor,reason:'Fixture deletion'});
  const deleted=(await listDeletedRecords(pool,asset.cemetery_id,'media_assets',{query:photo.id}))[0];
  const path=join(root,asset.storage_key);await rename(path,path+'.backup');
  await assert.rejects(()=>restoreDeletedRecord(pool,asset.cemetery_id,'media_assets',photo.id,{expectedVersion:deleted.version,reason:'Check original'},actor,{uploadRoot:root}),/original photo file is missing/);
  await rename(path+'.backup',path);await restoreDeletedRecord(pool,asset.cemetery_id,'media_assets',photo.id,{expectedVersion:deleted.version,reason:'Original bytes checked'},actor,{uploadRoot:root});
  const link=(await client.query('SELECT id,deleted_at FROM headstone_media_assets WHERE media_asset_id=$1',[photo.id])).rows[0];assert.ok(link.deleted_at,'asset restore does not revive deleted links');
  const removedLink=(await listDeletedRecords(pool,asset.cemetery_id,'headstone_media_assets',{query:link.id}))[0];await restoreDeletedRecord(pool,asset.cemetery_id,'headstone_media_assets',link.id,{expectedVersion:removedLink.version,reason:'Library context checked'},actor);
  assert.equal((await client.query('SELECT deleted_at FROM headstone_media_assets WHERE id=$1',[link.id])).rows[0].deleted_at,null);
 }finally{await client.query('ROLLBACK');await client.end();await rm(root,{recursive:true,force:true});}
});

test('inspection recovery keeps deleted photo contexts separate and advances editor revisions',async()=>{
 const {deleteMonumentInspections}=await import('../server/monumentInspections.mjs');const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
 try{
  await client.query('BEGIN');const pool=fieldTransactionPool(client),actor={role:'admin',subject:'fixture|inspection-restore'},{id}=await createInspectionFixture(client);
  const cemeteryId=(await client.query('SELECT g.cemetery_id FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid WHERE h.id=$1',[id])).rows[0].cemetery_id;
  const inspection=(await client.query("SELECT id,updated_at::text AS version FROM monument_inspections WHERE headstone_uuid=$1 AND source_type='field_survey'",[id])).rows[0];
  await deleteMonumentInspections(client,id,[{id:inspection.id,expectedUpdatedAt:inspection.version}]);
  const deleted=(await listDeletedRecords(pool,cemeteryId,'monument_inspections',{query:inspection.id}))[0];
  await restoreDeletedRecord(pool,cemeteryId,'monument_inspections',inspection.id,{expectedVersion:deleted.version,reason:'Original observation checked'},actor);
  const current=(await client.query('SELECT updated_at::text AS version FROM monument_inspections WHERE id=$1',[inspection.id])).rows[0];assert.notEqual(current.version,inspection.version);
  const contexts=(await client.query('SELECT id,deleted_at FROM monument_photo_contexts WHERE inspection_id=$1',[inspection.id])).rows;assert.ok(contexts.every(c=>c.deleted_at));
  const context=(await listDeletedRecords(pool,cemeteryId,'monument_photo_contexts',{query:contexts[0].id}))[0];await restoreDeletedRecord(pool,cemeteryId,'monument_photo_contexts',context.id,{expectedVersion:context.version,reason:'Original photo context checked'},actor);
 }finally{await client.query('ROLLBACK');await client.end();}
});

test('independent simultaneous merge approvals archive a donor exactly once',async()=>{
 const config=integrationAdminDatabase(loadApiConfig()),admin=new pg.Client(config);await admin.connect();const schema=`merge_race_${randomUUID().replaceAll('-','')}`;let pool;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);
  for(const table of ['burials','burial_record_merges','headstone_burials','burial_military_decorations','memorials','north_hills_ocr_source_facts','source_person_record_links','burial_place_evidence','headstones','monument_inspections','audit_events'])await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);
  pool=new pg.Pool({...config,max:3,options:`-c search_path=${schema},public -c lock_timeout=10000 -c statement_timeout=15000`});
  const grave=(await pool.query('SELECT id,cemetery_id FROM gravesites WHERE deleted_at IS NULL LIMIT 1')).rows[0],sourceId=randomUUID(),targetId=randomUUID(),actor={role:'admin',subject:'fixture|merge-race'};
  for(const id of [sourceId,targetId])await pool.query(`INSERT INTO burials(id,gravesite_uuid,first_name,last_name,interment_type_id,burial_record_status_type_id) VALUES($1,$2,'Race','Person',(SELECT id FROM burial_interment_types WHERE code='unknown'),(SELECT id FROM burial_record_status_types WHERE code='interred'))`,[id,grave.id]);
  const preview=await previewBurialMerge(pool,grave.cemetery_id,sourceId,targetId,actor);assert.deepEqual(preview.blockers,[]);
  const input={...preview,acknowledge:true,reason:'Reviewed once'};
  const outcomes=await Promise.all([mergeBurials(pool,grave.cemetery_id,input,actor),mergeBurials(pool,grave.cemetery_id,input,actor),mergeBurials(pool,grave.cemetery_id,input,actor)]);
  assert.equal(outcomes.filter(result=>result?.merged).length,1);assert.equal((await pool.query('SELECT count(*)::int AS n FROM burial_record_merges')).rows[0].n,1);
  assert.ok((await pool.query('SELECT deleted_at FROM burials WHERE id=$1',[sourceId])).rows[0].deleted_at);
 }finally{if(pool)await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
