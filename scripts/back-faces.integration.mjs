import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {createInspectionFixture} from './lib/inspection-fixtures.mjs';

const migration=await readFile(new URL('../db/changelog/changes/490-back-descriptions-as-faces.sql',import.meta.url),'utf8');

test('back migration preserves readings, face identities, historical visits and photo links',async()=>{
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 try{
  await c.query('BEGIN');
  await c.query('ALTER TABLE headstones ADD COLUMN IF NOT EXISTS back_description text');
  const {id}=await createInspectionFixture(c);
  const frontId=randomUUID();const text='  FRONT\nReading  ';const back='  BACK\nFamily memorial  ';
  const history=[{id:randomUUID(),text:'Previous front',source:'Fixture history',sourceDate:'2000'}];
  const face={id:frontId,label:'Unspecified face',inscription:text,notes:'Preserve notes',burialIds:[],mediaAssetIds:[],historicalTranscriptions:history};
  await c.query('UPDATE headstones SET faces=$2::jsonb,back_description=$3 WHERE id=$1',[id,JSON.stringify([face]),back]);
  await c.query(`INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,inscription,faces)
   SELECT id,'2027-01-01',2027,'field_survey','Later independent visit',condition_type_id,'Later front',$2::jsonb FROM headstones WHERE id=$1`,[id,JSON.stringify([{...face,inscription:'Later front'}])]);
  const before=(await c.query('SELECT * FROM headstones WHERE id=$1',[id])).rows[0];
  const snapshot=async()=>({
   untouched:(await c.query("SELECT to_jsonb(i) AS record FROM monument_inspections i WHERE headstone_uuid=$1 AND (source_type<>'field_survey' OR inspected_at<>'2026-06-12') ORDER BY id",[id])).rows,
   contexts:(await c.query('SELECT to_jsonb(c) AS record FROM monument_photo_contexts c ORDER BY id')).rows,
   media:(await c.query('SELECT to_jsonb(l) AS record FROM headstone_media_assets l ORDER BY id')).rows,
  });
  const original=await snapshot();
  const originalField=(await c.query("SELECT * FROM monument_inspections WHERE headstone_uuid=$1 AND origin_key='field:2026-06-12'",[id])).rows[0];
  await c.query(migration);
  const after=(await c.query('SELECT * FROM headstones WHERE id=$1',[id])).rows[0];
  assert.equal(Object.hasOwn(after,'back_description'),false);
  assert.deepEqual(after.faces.map(f=>f.label),['Front','Back']);
  assert.deepEqual(after.faces[0],{...before.faces[0],label:'Front'});
  assert.equal(after.faces[1].inscription,back);
  assert.equal(after.inscription,`Front\n${text}\n\nBack\n${back}`);
  assert.equal(after.faces_revision,before.faces_revision+1);
  assert.equal(after.source_properties.BackFaceMigration490.originalBackDescription,back);
  const field=(await c.query('SELECT * FROM monument_inspections WHERE id=$1',[originalField.id])).rows[0];
  assert.deepEqual(field.faces.map(f=>[f.id,f.label,f.inscription]),after.faces.map(f=>[f.id,f.label,f.inscription]));
  for(const key of ['id','headstone_uuid','inspected_at','inspection_year','source_type','source','condition_type_id','condition_notes','origin_key','manually_edited','created_at'])assert.deepEqual(field[key],originalField[key],key);
  assert.deepEqual(await snapshot(),original);
  // A later import of the same text must reuse Back rather than duplicate it.
  await c.query('ALTER TABLE headstones ADD COLUMN back_description text');
  await c.query('UPDATE headstones SET back_description=$2 WHERE id=$1',[id,back]);
  await c.query(migration);
  assert.deepEqual((await c.query('SELECT faces FROM headstones WHERE id=$1',[id])).rows[0].faces,after.faces);
  assert.deepEqual(await snapshot(),original);
 }finally{await c.query('ROLLBACK');await c.end()}
});

test('back migration preserves an existing Back reading and other faces; creates a blank Front when needed',async()=>{
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 try{
  await c.query('BEGIN');await c.query('ALTER TABLE headstones ADD COLUMN IF NOT EXISTS back_description text');
  const {id}=await createInspectionFixture(c);const {id:emptyId}=await createInspectionFixture(c);
  const front={id:randomUUID(),label:'Front',inscription:'Front',notes:'',burialIds:[],mediaAssetIds:[]};
  const back={...front,id:randomUUID(),label:'Back',inscription:'Existing Back',notes:'Keep Back notes'};
  const left={...front,id:randomUUID(),label:'Left',inscription:'Left'};
  await c.query('UPDATE headstones SET faces=$2::jsonb,back_description=$3 WHERE id=$1',[id,JSON.stringify([front,back,left]),'Additional Back']);
  await c.query("UPDATE headstones SET faces='[]'::jsonb,inscription='',back_description='Back only' WHERE id=$1",[emptyId]);
  await c.query(migration);
  const faces=(await c.query('SELECT faces FROM headstones WHERE id=$1',[id])).rows[0].faces;
  assert.deepEqual(faces.map(f=>f.id),[front.id,back.id,left.id]);assert.equal(faces[1].inscription,'Existing Back\n\nAdditional Back');assert.equal(faces[1].notes,'Keep Back notes');assert.equal(faces[2].inscription,'Left');
  const empty=(await c.query('SELECT faces FROM headstones WHERE id=$1',[emptyId])).rows[0].faces;
  assert.deepEqual(empty.map(f=>[f.label,f.inscription]),[['Front',''],['Back','Back only']]);
  await c.query('ALTER TABLE headstones ADD COLUMN back_description text');
  await c.query("UPDATE headstones SET back_description='Additional Back' WHERE id=$1",[id]);
  await c.query(migration);
  assert.deepEqual((await c.query('SELECT faces FROM headstones WHERE id=$1',[id])).rows[0].faces,faces);

 }finally{await c.query('ROLLBACK');await c.end()}
});
