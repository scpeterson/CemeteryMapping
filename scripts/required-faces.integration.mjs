import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {createInspectionFixture} from './lib/inspection-fixtures.mjs';
const migration=await readFile(new URL('../db/changelog/changes/491-require-monument-faces.sql',import.meta.url),'utf8');

test('every monument and visit gets its own face without changing existing faces or photo links',async()=>{
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 try{
  await c.query('BEGIN');
  // Recreate the pre-491 schema inside this rollback-only fixture.
  await c.query(`ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_require_face;
   ALTER TABLE monument_inspections DROP CONSTRAINT IF EXISTS monument_inspections_require_face;
   DROP TRIGGER IF EXISTS ensure_new_monument_face ON headstones;
   DROP TRIGGER IF EXISTS ensure_inspection_face ON monument_inspections;
   DROP FUNCTION IF EXISTS ensure_new_monument_face(); DROP FUNCTION IF EXISTS ensure_inspection_face();
   DROP FUNCTION IF EXISTS default_monument_face(uuid,text,text,text,jsonb);`);
  const {id}=await createInspectionFixture(c);const {id:existingId}=await createInspectionFixture(c);
  const history=[{id:randomUUID(),text:'Original historical reading',source:'Fixture source',sourceDate:'1990'}];
  const text='  Exact\ncurrent reading  ';
  await c.query('ALTER TABLE headstones DISABLE TRIGGER sync_headstone_faces');
  await c.query('ALTER TABLE headstones DISABLE TRIGGER capture_monument_inspection');
  await c.query("UPDATE headstones SET faces='[]'::jsonb,inscription=$2,inscription_status='transcribed',current_legibility='partially_legible',historical_transcriptions=$3::jsonb WHERE id=$1",[id,text,JSON.stringify(history)]);
  await c.query('ALTER TABLE headstones ENABLE TRIGGER capture_monument_inspection');
  await c.query('ALTER TABLE headstones ENABLE TRIGGER sync_headstone_faces');
  await c.query("UPDATE monument_inspections SET faces='[]'::jsonb,inscription=CASE source_type WHEN 'nhg' THEN 'Independent NHG reading' ELSE 'Independent field reading' END WHERE headstone_uuid=$1",[id]);
  const original=(await c.query('SELECT * FROM headstones WHERE id=$1',[id])).rows[0];
  const existing=(await c.query('SELECT * FROM headstones WHERE id=$1',[existingId])).rows[0];
  const visits=(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1 ORDER BY id',[id])).rows;
  const photos=async()=>({links:(await c.query('SELECT to_jsonb(c) AS r FROM monument_photo_contexts c ORDER BY id')).rows,media:(await c.query('SELECT to_jsonb(m) AS r FROM headstone_media_assets m ORDER BY id')).rows});
  const beforePhotos=await photos();
  await c.query(migration);
  const saved=(await c.query('SELECT * FROM headstones WHERE id=$1',[id])).rows[0];
  assert.equal(saved.faces.length,1);assert.equal(saved.faces[0].label,'Unspecified face');assert.equal(saved.faces[0].inscription,text);
  assert.equal(saved.faces[0].currentLegibility,'partially_legible');assert.deepEqual(saved.faces[0].historicalTranscriptions,history);
  assert.deepEqual(saved.historical_transcriptions,original.historical_transcriptions);
  assert.deepEqual(saved.faces[0].mediaAssetIds,[]);assert.deepEqual(saved.faces[0].burialIds,[]);
  assert.deepEqual((await c.query('SELECT * FROM headstones WHERE id=$1',[existingId])).rows[0],existing);
  for(const old of visits){const row=(await c.query('SELECT * FROM monument_inspections WHERE id=$1',[old.id])).rows[0];
   const oldFields={...old};const newFields={...row};const newFaces=row.faces;
   delete oldFields.faces;delete oldFields.updated_at;delete newFields.faces;delete newFields.updated_at;
   assert.deepEqual(newFields,oldFields);assert.equal(newFaces.length,1);assert.equal(newFaces[0].inscription,old.inscription);
   assert.equal(newFaces[0].label,'Unspecified face');assert.deepEqual(newFaces[0].mediaAssetIds,[]);
  }
  assert.deepEqual(await photos(),beforePhotos);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM headstones WHERE jsonb_array_length(faces)=0')).rows[0].n,0);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM monument_inspections WHERE jsonb_array_length(faces)=0')).rows[0].n,0);
  // Older clients/imports that omit faces still produce a persistent blank face.
  const {id:newId}=await createInspectionFixture(c);
  const row=(await c.query('SELECT * FROM headstones WHERE id=$1',[newId])).rows[0];
  await c.query("UPDATE headstones SET inscription='' WHERE id=$1",[newId]);
  const blank=(await c.query('SELECT * FROM headstones WHERE id=$1',[newId])).rows[0];
  assert.equal(blank.faces.length,1);assert.equal(blank.faces[0].id,row.faces[0].id);assert.equal(blank.faces[0].inscription,'');
  for(const status of ['not_recorded','blank','illegible']){
   const legibility=status==='not_recorded'?'unknown':status;
   const created=(await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,marker_scope_type_id,material_type_id,condition_type_id,
    inscription,inscription_status,current_legibility,historical_transcriptions)
    SELECT $2,gravesite_uuid,marker_type_id,marker_scope_type_id,material_type_id,condition_type_id,'',$3,$4,$5::jsonb FROM headstones WHERE id=$1 RETURNING *`,
    [newId,`MIN-FACE-${randomUUID()}`,status,legibility,JSON.stringify(history)])).rows[0];
   assert.equal(created.faces.length,1);assert.equal(created.faces[0].inscriptionStatus,status);
   assert.equal(created.faces[0].currentLegibility,legibility);assert.deepEqual(created.faces[0].historicalTranscriptions,history);
   assert.equal(created.faces[0].inscription,'');
  }
  await c.query('SAVEPOINT before_remove');
  await assert.rejects(c.query("UPDATE headstones SET faces='[]'::jsonb WHERE id=$1",[newId]),/headstones_require_face/);
  await c.query('ROLLBACK TO SAVEPOINT before_remove');
  const visit=(await c.query("SELECT * FROM monument_inspections WHERE headstone_uuid=$1 AND source_type='nhg'",[newId])).rows[0];
  await c.query('SAVEPOINT before_visit_remove');
  await assert.rejects(c.query("UPDATE monument_inspections SET faces='[]'::jsonb WHERE id=$1",[visit.id]),/monument_inspections_require_face/);
  await c.query('ROLLBACK TO SAVEPOINT before_visit_remove');
  await c.query('UPDATE monument_inspections SET inscription=$2 WHERE id=$1',[visit.id,'Updated source reading']);
  const updated=(await c.query('SELECT faces FROM monument_inspections WHERE id=$1',[visit.id])).rows[0].faces;
  assert.equal(updated[0].id,visit.faces[0].id);assert.equal(updated[0].inscription,'Updated source reading');assert.equal(updated[0].inscriptionStatus,'transcribed');
 }finally{await c.query('ROLLBACK');await c.end()}
});
