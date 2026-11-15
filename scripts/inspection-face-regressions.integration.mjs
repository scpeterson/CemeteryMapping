import {createInspectionFixture} from './lib/inspection-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {loadDbEnvironment} from './lib/run-liquibase.mjs';
import {setAuditContext} from '../server/auditContext.mjs';
import {insertMonumentInspections,updateMonumentInspections,validateNewInspections} from '../server/monumentInspections.mjs';
import {ConflictError} from '../server/requestValidation.mjs';
import {listPhotoContexts,savePhotoContext} from '../server/monumentPhotoContexts.mjs';

// Every fixture lives inside a transaction: even a failing assertion leaves the
// administrator's inspections, photos and audit history untouched.
async function withFixture(run){
 const env=loadDbEnvironment(process.env.APP_ENV??'test');
 const c=new pg.Client({host:'127.0.0.1',port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD});
 await c.connect();
 try{
  await c.query('BEGIN');
  await setAuditContext(c,{actorUser:{role:'admin'},reason:'Rolled-back inspection face regression'});
  const fixture=await createInspectionFixture(c);
  const marker=(await c.query('SELECT id,condition_type_id FROM headstones WHERE id=$1',[fixture.id])).rows[0];
  assert.ok(marker,'Multi-face fixture monument is available');
  const snapshot=async()=>({
   inspections:(await c.query('SELECT to_jsonb(i) AS row FROM monument_inspections i WHERE headstone_uuid=$1 ORDER BY id',[marker.id])).rows,
   links:await listPhotoContexts(c,marker.id),
   photos:(await c.query('SELECT to_jsonb(m) AS photo,to_jsonb(l) AS link FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id WHERE l.headstone_uuid=$1 ORDER BY m.id',[marker.id])).rows,
  });
  const baseline=await snapshot();
  const source=baseline.inspections.find(x=>x.row.source_type==='field_survey')?.row;
  assert.ok(source,'Original field inspection is available');
  // Build independent surfaces rather than requiring administrator-entered faces.
  const faces=['Front','Left','Back'].map(label=>({id:randomUUID(),label,inscription:`${label} regression reading`}));
  const [entry]=validateNewInspections([{id:randomUUID(),inspectedAt:'2027-01-01',sourceType:'field_survey',source:'Regression fixture',conditionId:marker.condition_type_id,conditionNotes:'',inscription:source.inscription,faces}]);
  await insertMonumentInspections(c,marker.id,[entry]);
  const saved=async()=>(await c.query('SELECT to_jsonb(i) AS row,updated_at::text AS version FROM monument_inspections i WHERE id=$1',[entry.id])).rows[0];
  const proxy={connect:async()=>({release(){},query(sql,params){if(sql==='BEGIN')return c.query('SAVEPOINT photo_regression');if(sql==='COMMIT')return c.query('RELEASE SAVEPOINT photo_regression');if(sql==='ROLLBACK')return c.query('ROLLBACK TO SAVEPOINT photo_regression');return c.query(sql,params);}})};
  await run({c,marker,entry,saved,proxy,baseline});
  const after=await snapshot();
  assert.deepEqual(after.inspections.filter(x=>x.row.id!==entry.id),baseline.inspections,'Original inspections, face evidence and timestamps are unchanged');
  assert.deepEqual(after.links.filter(x=>x.inspectionId!==entry.id),baseline.links,'Original observation photo links are unchanged');
  assert.deepEqual(after.photos,baseline.photos,'Photo files and monument library records are unchanged');
 }finally{await c.query('ROLLBACK');await c.end();}
}

test('a face with photo links cannot be removed; unlinking allows removal without deleting the photo',async()=>{
 await withFixture(async({c,marker,entry,saved,proxy,baseline})=>{
  const photoId=baseline.links.find(x=>x.inspectionId)?.mediaAssetId;
  assert.ok(photoId);
  const faceId=entry.faces[0].id;
  await savePhotoContext(proxy,marker.id,photoId,{inspectionId:entry.id,faceId},{actorUser:{role:'admin'}});
  const before=await saved();
  const reduced=entry.faces.slice(1);
  await assert.rejects(updateMonumentInspections(c,marker.id,[{...entry,faces:reduced,expectedUpdatedAt:before.version}]),ConflictError);
  assert.deepEqual(await saved(),before,'Rejected face removal does not modify the inspection or version');
  const links=await listPhotoContexts(c,marker.id);
  assert.ok(links.some(x=>x.inspectionId===entry.id&&x.faceId===faceId&&x.mediaAssetId===photoId));
  await savePhotoContext(proxy,marker.id,photoId,{inspectionId:entry.id},{actorUser:{role:'admin'},remove:true});
  await updateMonumentInspections(c,marker.id,[{...entry,faces:reduced,expectedUpdatedAt:before.version}]);
  assert.deepEqual((await saved()).row.faces,reduced);
 });
});

test('two editors using the same version cannot overwrite a newer face reading',async()=>{
 await withFixture(async({c,marker,entry,saved})=>{
  const opened=await saved();
  const first={...entry,faces:entry.faces.map((face,i)=>i===0?{...face,inscription:'First editor front reading'}:face),expectedUpdatedAt:opened.version};
  const stale={...entry,faces:entry.faces.map((face,i)=>i===1?{...face,inscription:'Stale editor back reading'}:face),expectedUpdatedAt:opened.version};
  await updateMonumentInspections(c,marker.id,[first]);
  const committed=await saved();
  assert.notEqual(committed.version,opened.version);
  await assert.rejects(updateMonumentInspections(c,marker.id,[stale]),ConflictError);
  assert.deepEqual(await saved(),committed,'Stale save cannot change any reading or the newer timestamp');
  assert.equal(committed.row.faces[0].inscription,'First editor front reading');
  assert.deepEqual(committed.row.faces.slice(1),entry.faces.slice(1));
 });
});

test('face designs round-trip and clear independently without changing other readings or photos',async()=>{
 await withFixture(async({c,marker,entry,saved})=>{
  const faces=entry.faces.map((face,index)=>({...face,designNotes:index?'Border carving':'  Etched ivy\nCarved rose  '}));
  const [designed]=validateNewInspections([{...entry,faces}]);
  await c.query('DELETE FROM monument_inspections WHERE id=$1',[entry.id]);
  await insertMonumentInspections(c,marker.id,[designed]);
  const before=await saved();assert.deepEqual(before.row.faces,faces);
  const [cleared]=validateNewInspections([{...designed,expectedUpdatedAt:before.version,faces:faces.map((face,index)=>index?face:{...face,designNotes:''})}],{updating:true});
  await updateMonumentInspections(c,marker.id,[cleared]);
  const after=await saved();assert.deepEqual(after.row.faces,[{...faces[0],designNotes:''},...faces.slice(1)]);
  assert.equal(after.row.inscription,before.row.inscription);
 });
});


test('inspection statuses and history survive saves and legacy updates without modifying older evidence', async()=>{
 await withFixture(async({c,marker,entry,saved})=>{
  const markerBefore=(await c.query('SELECT faces,historical_transcriptions,inscription FROM headstones WHERE id=$1',[marker.id])).rows[0];
  const history=[{id:randomUUID(),text:'  Earlier sourced text\n[illegible]  ',source:'Old register',sourceDate:'1901'}];
  const faces=entry.faces.map((face,index)=>({...face,inscription:index?'':'[ILLEGIBLE]',historicalTranscriptions:history}));
  faces[1]={...faces[1],inscriptionStatus:'blank',currentLegibility:'blank'};
  const [payload]=validateNewInspections([{...entry,faces}],{updating:false});
  await updateMonumentInspections(c,marker.id,[{...payload,expectedUpdatedAt:(await saved()).version}]);
  let before=await saved();
  assert.deepEqual(before.row.faces,payload.faces);
  assert.equal(before.row.faces[0].inscriptionStatus,'illegible');
  assert.equal(before.row.faces[1].inscriptionStatus,'blank');
  // Older clients may omit status/history keys. Keep evidence while clearing
  // obsolete terminal flags when they submit a real reading.
  const legacyFaces=entry.faces.map(face=>({id:face.id,label:face.label,inscription:'  Blank family\nName [illegible] 1880  '}));
  await updateMonumentInspections(c,marker.id,[{...entry,faces:legacyFaces,expectedUpdatedAt:before.version}]);
  before=await saved();
  for(const [index,face] of before.row.faces.entries()){
   assert.equal(face.inscription,legacyFaces[0].inscription);
   assert.equal(face.inscriptionStatus,index<2?'transcribed':undefined);
   assert.notEqual(face.currentLegibility,'blank');assert.notEqual(face.currentLegibility,'illegible');
   assert.deepEqual(face.historicalTranscriptions,history);
  }
  const [cleared]=validateNewInspections([{...entry,faces:before.row.faces.map(face=>({...face,inscription:'',inscriptionStatus:'not_recorded',currentLegibility:'unknown'})),expectedUpdatedAt:before.version}],{updating:true});
  await updateMonumentInspections(c,marker.id,[cleared]);
  assert.deepEqual((await saved()).row.faces,cleared.faces);
  assert.deepEqual((await c.query('SELECT faces,historical_transcriptions,inscription FROM headstones WHERE id=$1',[marker.id])).rows[0],markerBefore,'Stored marker readings and source history remain unchanged');
 });
});
