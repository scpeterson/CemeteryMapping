import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHeadstonePhoto} from '../server/mediaRepository.mjs';
import {randomUUID} from 'node:crypto';
import {loadDbEnvironment} from './lib/run-liquibase.mjs';
import {listPhotoContexts,savePhotoContext} from '../server/monumentPhotoContexts.mjs';
import {selectHeadstoneMutationState} from '../server/cemeteryMutationTargets.mjs';
import {insertMonumentInspections,updateMonumentInspections} from '../server/monumentInspections.mjs';

test('photos backfill to 2026 only; independent record links preserve files, original observations and monument ownership',async()=>{
 const env=loadDbEnvironment(process.env.APP_ENV??'test');
 const c=new pg.Client({host:'127.0.0.1',port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD});await c.connect();
 const uploadRoot=await mkdtemp(join(tmpdir(),'record-photo-test-'));
 try{
  await c.query('BEGIN');
  const originalInspections=(await c.query('SELECT to_jsonb(i) AS snapshot FROM monument_inspections i ORDER BY id')).rows;
  if(!(await c.query("SELECT to_regclass('monument_photo_contexts') AS name")).rows[0].name) await c.query(await readFile(new URL('../db/changelog/changes/487-monument-photo-contexts.sql',import.meta.url),'utf8'));
  assert.deepEqual((await c.query('SELECT to_jsonb(i) AS snapshot FROM monument_inspections i ORDER BY id')).rows,originalInspections);
  assert.equal((await c.query(`SELECT count(*)::int AS n FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id JOIN headstones h ON h.id=l.headstone_uuid
   WHERE l.deleted_at IS NULL AND l.status='linked' AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo' AND h.deleted_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM monument_photo_contexts x JOIN monument_inspections i ON i.id=x.inspection_id WHERE x.headstone_uuid=h.id AND x.media_asset_id=m.id AND i.inspection_year=2026 AND i.source_type='field_survey' AND x.deleted_at IS NULL)`)).rows[0].n,0);
  const markerId=(await c.query("SELECT id FROM headstones WHERE headstone_id='TLC-HS-0189' AND deleted_at IS NULL")).rows[0].id;
  const marker=await selectHeadstoneMutationState(c,markerId);
  const originals=(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1 ORDER BY id',[markerId])).rows;
  const field=originals.find(i=>i.source_type==='field_survey');const nhg=originals.find(i=>i.source_type==='nhg');
  const baseline=await listPhotoContexts(c,markerId);assert.equal(baseline.filter(x=>x.inspectionId===field.id).length,2);assert.equal(baseline.filter(x=>x.inspectionId===nhg.id).length,0);
  const librarySnapshot=()=>c.query('SELECT to_jsonb(m) AS photo,to_jsonb(l) AS link FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id WHERE l.headstone_uuid=$1 ORDER BY m.id',[markerId]);
  const originalLibrary=(await librarySnapshot()).rows;
  const photoId=baseline[0].mediaAssetId;
  const newId=randomUUID();
  const faceId=randomUUID(),backId=randomUUID();
  const faceReadings=[{id:faceId,label:'Front',inscription:'  Front reading\n',notes:'Original face evidence'},{id:backId,label:'Back',inscription:'Back reading'}];
  await insertMonumentInspections(c,markerId,[{faces:faceReadings,id:newId,inspectedAt:'2027-01-01',sourceType:'field_survey',source:'Test visit',conditionId:marker.condition_type_id,conditionNotes:'',inscription:field.inscription}]);
  assert.equal((await listPhotoContexts(c,markerId)).filter(x=>x.inspectionId===newId).length,0,'new inspection has no copied photo links');
  const maintenance=(await c.query(`INSERT INTO maintenance_records(cemetery_id,headstone_uuid,action_type_id,priority_type_id,status,notes)
   SELECT $1,$2,(SELECT id FROM maintenance_action_types LIMIT 1),(SELECT id FROM maintenance_priority_types LIMIT 1),'completed','Test only' RETURNING id`,[marker.cemetery_id,markerId])).rows[0];
  const proxy={connect:async()=>({release(){},query(sql,params){if(sql==='BEGIN')return c.query('SAVEPOINT photo_api');if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT photo_api');if(sql==='ROLLBACK')return c.query('ROLLBACK TO SAVEPOINT photo_api');return c.query(sql,params);}})};
  await assert.rejects(savePhotoContext(proxy,markerId,photoId,{inspectionId:newId,phase:'after'},{actorUser:{role:'power-user'}}),{statusCode:403});
  assert.equal(await savePhotoContext(proxy,markerId,photoId,{inspectionId:newId},{actorUser:{role:'cemetery-admin'},allowedCemeteryIds:[]}),undefined);
  await savePhotoContext(proxy,markerId,photoId,{maintenanceRecordId:maintenance.id,phase:'before'},{actorUser:{role:'power-user'}});
  await savePhotoContext(proxy,markerId,photoId,{maintenanceRecordId:maintenance.id,phase:'after'},{actorUser:{role:'power-user'}});
  let links=await listPhotoContexts(c,markerId);assert.equal(links.filter(x=>x.maintenanceRecordId===maintenance.id).length,1);assert.equal(links.find(x=>x.maintenanceRecordId===maintenance.id).phase,'after');
  assert.deepEqual(links.filter(x=>x.inspectionId),baseline,'maintenance link preserves both inspections’ exact photo links');
  assert.deepEqual((await librarySnapshot()).rows,originalLibrary,'maintenance link preserves every monument photo and library link');
  await assert.rejects(savePhotoContext(proxy,markerId,photoId,{inspectionId:newId,faceId:randomUUID()},{actorUser:{role:'admin'}}),/face does not belong/);
  await savePhotoContext(proxy,markerId,photoId,{inspectionId:newId,faceId,phase:'unspecified'},{actorUser:{role:'admin'}});
  assert.equal((await listPhotoContexts(c,markerId)).find(x=>x.inspectionId===newId).faceId,faceId);
  const version=(await c.query('SELECT updated_at::text AS version FROM monument_inspections WHERE id=$1',[newId])).rows[0].version;
  await updateMonumentInspections(c,markerId,[{id:newId,inspectedAt:'2027-01-01',inspectionYear:2027,sourceType:'field_survey',source:'Test visit',conditionId:marker.condition_type_id,conditionNotes:'',inscription:field.inscription,faces:faceReadings.map(({id,label,inscription})=>({id,label,inscription:id===backId?'Edited back':inscription})),expectedUpdatedAt:version}]);
  const savedFaces=(await c.query('SELECT faces FROM monument_inspections WHERE id=$1',[newId])).rows[0].faces;
  assert.equal(savedFaces[0].inscription,faceReadings[0].inscription);
  assert.equal(savedFaces[0].notes,'Original face evidence','editing readings preserves existing face evidence');
  assert.equal(savedFaces[1].inscription,'Edited back');

  await savePhotoContext(proxy,markerId,photoId,{inspectionId:newId},{actorUser:{role:'admin'},remove:true});
  links=await listPhotoContexts(c,markerId);assert.equal(links.filter(x=>x.inspectionId===newId).length,0);assert.equal(links.filter(x=>x.inspectionId===field.id).length,2);assert.ok(links.some(x=>x.maintenanceRecordId===maintenance.id));
  await savePhotoContext(proxy,markerId,photoId,{maintenanceRecordId:maintenance.id},{actorUser:{role:'power-user'},remove:true});
  links=await listPhotoContexts(c,markerId);
  assert.equal(links.filter(x=>x.maintenanceRecordId===maintenance.id).length,0,'unlinked photo disappears from maintenance action');
  assert.deepEqual(links,baseline,'unlinking maintenance photo preserves both inspections’ exact photo links');
  assert.deepEqual((await librarySnapshot()).rows,originalLibrary,'unlinking maintenance photo preserves all monument photos and library links');
  const foreign=(await c.query('SELECT id FROM monument_inspections WHERE headstone_uuid<>$1 LIMIT 1',[markerId])).rows[0];
  await assert.rejects(savePhotoContext(proxy,markerId,photoId,{inspectionId:foreign.id},{actorUser:{role:'admin'}}),/does not belong/);
  await assert.rejects(savePhotoContext(proxy,markerId,randomUUID(),{inspectionId:newId},{actorUser:{role:'admin'}}),/active photo/);
  assert.deepEqual((await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1 AND id<>$2 ORDER BY id',[markerId,newId])).rows,originals);
  assert.equal((await c.query('SELECT deleted_at FROM media_assets WHERE id=$1',[photoId])).rows[0].deleted_at,null);
  const file={bytes:Buffer.from('integration photo'),contentType:'image/jpeg',originalFilename:'verification.jpg'};
  await assert.rejects(createHeadstonePhoto(proxy,markerId,file,{inspectionId:foreign.id},{actorUser:{role:'admin'},uploadRoot}),/does not belong/);
  assert.equal((await readdir(uploadRoot)).length,0,'foreign target rejected before publishing a file');
  const uploaded=await createHeadstonePhoto(proxy,markerId,file,{inspectionId:newId,faceId:backId,phase:'after',capturedAt:'2027-01-01'},{actorUser:{role:'admin'},uploadRoot});
  assert.ok(uploaded.id);assert.equal((await readdir(uploadRoot)).length,1);
  links=await listPhotoContexts(c,markerId);
  assert.ok(links.some(link=>link.mediaAssetId===uploaded.id&&link.inspectionId===newId&&link.faceId===backId&&link.phase==='after'));
  assert.equal(links.filter(link=>link.inspectionId===field.id).length,2);
  assert.equal(links.filter(link=>link.inspectionId===nhg.id).length,0);
  await c.query('SET LOCAL ROLE cemetery_api');await listPhotoContexts(c,markerId);await c.query('RESET ROLE');
 }finally{await c.query('ROLLBACK');await c.end();await rm(uploadRoot,{recursive:true,force:true});}
});
