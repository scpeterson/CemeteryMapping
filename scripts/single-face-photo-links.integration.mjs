import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {createInspectionFixture} from './lib/inspection-fixtures.mjs';
const migration=await readFile(new URL('../db/changelog/changes/493-single-face-photo-links.sql',import.meta.url),'utf8');

test('single-face photo backfill labels existing links without copying photos between observations',async()=>{
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 try{
  await c.query('BEGIN');const {id}=await createInspectionFixture(c);const {id:multiId}=await createInspectionFixture(c);
  const multiFace=(await c.query('SELECT faces FROM headstones WHERE id=$1',[multiId])).rows[0].faces[0];
  await c.query('UPDATE headstones SET faces=$2::jsonb WHERE id=$1',[multiId,JSON.stringify([multiFace,{...multiFace,id:randomUUID(),label:'Back',inscription:'Back reading'}])]);
  const originalField=(await c.query("SELECT * FROM monument_inspections WHERE headstone_uuid=$1 AND source_type='field_survey'",[id])).rows[0];
  const visitFaceId=randomUUID();
  await c.query("UPDATE monument_inspections SET faces=jsonb_set(faces,'{0,id}',to_jsonb($2::text)) WHERE id=$1",[originalField.id,visitFaceId]);
  const photo=(await c.query('SELECT media_asset_id FROM monument_photo_contexts WHERE inspection_id=$1 ORDER BY id LIMIT 1',[originalField.id])).rows[0].media_asset_id;
  const maintenance=(await c.query(`INSERT INTO maintenance_records(cemetery_id,headstone_uuid,action_type_id,priority_type_id,status,notes)
   SELECT g.cemetery_id,h.id,(SELECT id FROM maintenance_action_types LIMIT 1),(SELECT id FROM maintenance_priority_types LIMIT 1),'completed','Single face photo fixture'
   FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid WHERE h.id=$1 RETURNING id`,[id])).rows[0];
  await c.query("INSERT INTO monument_photo_contexts(headstone_uuid,media_asset_id,maintenance_record_id,phase) VALUES($1,$2,$3,'after')",[id,photo,maintenance.id]);
  const rows=async(table)=>(await c.query(`SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY id`)).rows.map(r=>r.record);
  const beforeH=await rows('headstones'),beforeI=await rows('monument_inspections'),beforeC=await rows('monument_photo_contexts');
  const library=async()=>({media:await rows('media_assets'),links:await rows('headstone_media_assets')});const beforeLibrary=await library();
  await c.query(migration);
  const afterH=await rows('headstones'),afterC=await rows('monument_photo_contexts');
  assert.deepEqual(await rows('monument_inspections'),beforeI,'all inspection snapshots are untouched');
  assert.deepEqual(await library(),beforeLibrary,'library and monument ownership unchanged');
  assert.equal(afterC.length,beforeC.length,'no inspection/maintenance photo links created');
  for(const old of beforeH){const saved=afterH.find(h=>h.id===old.id);
   if(old.faces.length!==1||old.faces[0].label!=='Front'||old.deleted_at){assert.deepEqual(saved,old);continue;}
   const photos=(await c.query(`SELECT m.id FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id WHERE l.headstone_uuid=$1 AND l.deleted_at IS NULL AND l.status='linked' AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo' ORDER BY m.id`,[old.id])).rows.map(r=>r.id);
   const expected=[...(old.faces[0].mediaAssetIds??[]),...photos.filter(id=>!(old.faces[0].mediaAssetIds??[]).includes(id))];
   assert.deepEqual(saved.faces,[{...old.faces[0],mediaAssetIds:expected}]);
   for(const key of Object.keys(old).filter(k=>!['faces','updated_at','faces_revision'].includes(k)))assert.deepEqual(saved[key],old[key],key);
  }
  for(const old of beforeC){const saved=afterC.find(c=>c.id===old.id);const h=beforeH.find(h=>h.id===old.headstone_uuid);
   const visit=beforeI.find(i=>i.id===old.inspection_id);const faces=visit?.faces??h.faces;
   if(saved.face_id!==old.face_id){assert.equal(old.face_id,null);assert.equal(h.faces.length,1);assert.equal(faces.length,1);assert.equal(saved.face_id,faces[0].id);}
   for(const key of Object.keys(old).filter(k=>!['face_id','updated_at'].includes(k)))assert.deepEqual(saved[key],old[key],key);
  }
  const own=afterH.find(h=>h.id===id);assert.equal(own.faces[0].mediaAssetIds.length,2);
  const field=beforeI.find(i=>i.headstone_uuid===id&&i.source_type==='field_survey');
  assert.ok(afterC.filter(c=>c.inspection_id===field.id).every(c=>c.face_id===field.faces[0].id));
  assert.equal(afterC.find(c=>c.maintenance_record_id===maintenance.id).face_id,own.faces[0].id);
  const snapshot={h:afterH,c:afterC};await c.query(migration);assert.deepEqual({h:await rows('headstones'),c:await rows('monument_photo_contexts')},snapshot,'repeat backfill is idempotent');
 }finally{await c.query('ROLLBACK');await c.end();}
});
