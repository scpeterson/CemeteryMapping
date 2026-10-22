import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {createInspectionFixture} from './lib/inspection-fixtures.mjs';
const migration=await readFile(new URL('../db/changelog/changes/492-default-front-face.sql',import.meta.url),'utf8');

test('single-face monuments use Front without changing readings, IDs, metadata or photo links',async()=>{
 const config=loadApiConfig();assert.equal(config.appEnv,'test');
 const c=new pg.Client(integrationAdminDatabase(config));await c.connect();
 try{
  await c.query('BEGIN');const {id}=await createInspectionFixture(c);const {id:multiId}=await createInspectionFixture(c);
  const face={id:randomUUID(),label:'North',inscription:'  Original\nreading  ',notes:'Keep notes',burialIds:[],mediaAssetIds:[]};
  await c.query('UPDATE headstones SET faces=$2::jsonb WHERE id=$1',[id,JSON.stringify([face])]);
  await c.query('UPDATE headstones SET faces=$2::jsonb WHERE id=$1',[multiId,JSON.stringify([face,{...face,id:randomUUID(),label:'Back',inscription:'Back reading'}])]);
  const before=(await c.query('SELECT * FROM headstones WHERE id=$1',[id])).rows[0];
  const visits=(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1 ORDER BY id',[id])).rows;
  const multi=async()=>({marker:(await c.query('SELECT * FROM headstones WHERE id=$1',[multiId])).rows[0],visits:(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1 ORDER BY id',[multiId])).rows});
  const beforeMulti=await multi();
  const photos=async()=>(await c.query('SELECT to_jsonb(c) AS record FROM monument_photo_contexts c ORDER BY id')).rows;
  const beforePhotos=await photos();
  await c.query(migration);
  const saved=(await c.query('SELECT * FROM headstones WHERE id=$1',[id])).rows[0];
  assert.deepEqual(saved.faces,[{...before.faces[0],label:'Front'}]);assert.equal(saved.inscription,before.inscription);
  assert.equal(saved.faces_revision,before.faces_revision+1);
  for(const old of visits){const savedVisit=(await c.query('SELECT * FROM monument_inspections WHERE id=$1',[old.id])).rows[0];
   assert.deepEqual(savedVisit.faces,[{...old.faces[0],label:'Front'}]);
   for(const key of Object.keys(old).filter(k=>!['faces','updated_at'].includes(k)))assert.deepEqual(savedVisit[key],old[key],key);
  }
  assert.deepEqual(await multi(),beforeMulti);assert.deepEqual(await photos(),beforePhotos);
  // Legacy writers supplying no face information also get Front, with a stable
  // identity shared by their field snapshot; source updates retain that ID.
  const {id:createdId}=await createInspectionFixture(c);
  const created=(await c.query('SELECT faces FROM headstones WHERE id=$1',[createdId])).rows[0].faces;
  assert.equal(created.length,1);assert.equal(created[0].label,'Front');
  const nhg=(await c.query("SELECT * FROM monument_inspections WHERE headstone_uuid=$1 AND source_type='nhg'",[createdId])).rows[0];
  assert.equal(nhg.faces[0].label,'Front');assert.equal(nhg.faces[0].id,created[0].id);
  await c.query('UPDATE monument_inspections SET inscription=$2 WHERE id=$1',[nhg.id,'Updated source reading']);
  const updated=(await c.query('SELECT faces FROM monument_inspections WHERE id=$1',[nhg.id])).rows[0].faces;
  assert.equal(updated[0].id,nhg.faces[0].id);assert.equal(updated[0].inscription,'Updated source reading');
 }finally{await c.query('ROLLBACK');await c.end()}
});
