import {createInspectionFixture} from './lib/inspection-fixtures.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { updateHeadstone } from '../server/cemeteryHeadstoneMutations.mjs';
import { selectHeadstoneById } from '../server/cemeteryHeadstoneQueries.mjs';
import { updateMonumentInspections, validateNewInspections } from '../server/monumentInspections.mjs';
import { toHeadstone } from '../server/cemeteryMappers.mjs';
import { readFile } from 'node:fs/promises';
import { loadDbEnvironment } from './lib/run-liquibase.mjs';

test('inspection migration separates NHG and field evidence and preserves later field visits', async()=>{
 const env=loadDbEnvironment(process.env.APP_ENV ?? 'test');
 const c=new pg.Client({host:'127.0.0.1',port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD});
 await c.connect();
 try {
  await c.query('BEGIN');
  const exists=(await c.query("SELECT to_regclass('monument_inspections') AS name")).rows[0].name;
  if(!exists) await c.query(await readFile(new URL('../db/changelog/changes/485-monument-inspections.sql',import.meta.url),'utf8'));
  const manual=(await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='monument_inspections' AND column_name='manually_edited') AS exists")).rows[0].exists;
  if(!manual) await c.query(await readFile(new URL('../db/changelog/changes/486-editable-monument-inspections.sql',import.meta.url),'utf8'));
  assert.equal((await c.query("SELECT count(*)::int AS n FROM monument_inspections WHERE source_type='nhg' AND inspected_at IS DISTINCT FROM DATE '2005-10-11'")).rows[0].n,0);
  const fixture=await createInspectionFixture(c);
  const descriptorFixture=await createInspectionFixture(c);
  const {rows:[marker]}=await c.query("SELECT h.* FROM headstones h JOIN monument_inspections i ON i.headstone_uuid=h.id WHERE i.source_type='nhg' AND h.deleted_at IS NULL AND jsonb_array_length(h.faces)<=1 AND h.id=$1 LIMIT 1 FOR UPDATE OF h",[fixture.id]);
  assert.ok(marker,'requires a migrated NHG monument');
  const detail=toHeadstone(await selectHeadstoneById(c,marker.id));
  assert.ok(detail.inspections.some(i=>i.sourceType==='nhg' && i.inspectedAt==='2005-10-11'));
  // Exercise the real runtime role's permissions, including trigger writes.
  await c.query('SET LOCAL ROLE cemetery_api');
  await selectHeadstoneById(c,marker.id);
  await c.query("UPDATE headstones SET condition_notes=condition_notes WHERE id=$1",[marker.id]);
  await c.query('RESET ROLE');
  const before=(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1 ORDER BY id',[marker.id])).rows;
  assert.ok(before.some(i=>i.source_type==='field_survey'));
  await c.query("UPDATE headstones SET last_inspected_at='2026-10-20',condition_notes='Field-only weathering observation' WHERE id=$1",[marker.id]);
  let after=(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1',[marker.id])).rows;
  const nhg=after.find(i=>i.source_type==='nhg');
  assert.equal(nhg.inscription,before.find(i=>i.source_type==='nhg').inscription);
  assert.equal(nhg.condition_type_id,before.find(i=>i.source_type==='nhg').condition_type_id);
  assert.ok(!nhg.condition_notes.includes('Field-only'));
  await c.query("UPDATE headstones SET last_inspected_at='2027-01-05',condition_notes='Later visit' WHERE id=$1",[marker.id]);
  after=(await c.query('SELECT * FROM monument_inspections WHERE headstone_uuid=$1',[marker.id])).rows;
  assert.ok(after.some(i=>i.condition_notes==='Field-only weathering observation'));
  assert.ok(after.some(i=>i.condition_notes==='Later visit'));
  assert.equal(after.filter(i=>i.source_type==='nhg').length,1);
  const savedDetail=toHeadstone(await selectHeadstoneById(c,marker.id));
  const selected=savedDetail.inspections.find(i=>i.sourceType==='nhg');
  const correction=validateNewInspections([{...selected,expectedUpdatedAt:selected.updatedAt,inscription:'Corrected source reading',conditionNotes:'Reviewed NHG condition'}],{updating:true});
  await updateMonumentInspections(c,marker.id,correction);
  await c.query("SELECT refresh_nhg_inspection($1)",[marker.id]);
  const corrected=toHeadstone(await selectHeadstoneById(c,marker.id)).inspections.find(i=>i.id===selected.id);
  assert.equal(corrected.inscription,'Corrected source reading');
  assert.equal(corrected.conditionNotes,'Reviewed NHG condition');
  await assert.rejects(updateMonumentInspections(c,marker.id,correction),/changed since/);
  // Exercise the actual mutation transaction using savepoints inside this rollback fixture.
  const apiPool={connect:async()=>({release(){},query(sql,params){
   if(sql==='BEGIN') return c.query('SAVEPOINT inspection_api');
   if(sql==='COMMIT') return c.query('RELEASE SAVEPOINT inspection_api');
   if(sql==='ROLLBACK') return c.query('ROLLBACK TO SAVEPOINT inspection_api');
   return c.query(sql,params);
  }})};
  const newInspection=validateNewInspections([{id:randomUUID(),inspectedAt:'2026-10-22',sourceType:'field_survey',source:'Test inspector',conditionId:marker.condition_type_id,conditionNotes:'New inspection notes',inscription:'  Copied\nreading  '}]);
  const inspectionPayload={inspectionChangesOnly:true,newInspections:newInspection};
  await assert.rejects(updateHeadstone(apiPool,marker.id,inspectionPayload,{actorUser:{role:'power-user'}}),{statusCode:403});
  assert.equal(await updateHeadstone(apiPool,marker.id,inspectionPayload,{actorUser:{role:'cemetery-admin'},allowedCemeteryIds:[]}),undefined);
  const physicalBefore=(await c.query('SELECT inscription,condition_notes,last_inspected_at FROM headstones WHERE id=$1',[marker.id])).rows[0];
  const added=await updateHeadstone(apiPool,marker.id,inspectionPayload,{actorUser:{role:'cemetery-admin'}});
  assert.equal(added.inspections.find(i=>i.id===newInspection[0].id).inscription,'  Copied\nreading  ');
  assert.deepEqual((await c.query('SELECT inscription,condition_notes,last_inspected_at FROM headstones WHERE id=$1',[marker.id])).rows[0],physicalBefore);
  const linked={id:descriptorFixture.id};
  for(const [descriptor,code] of [['upright, exc cond','excellent'],['flat, good cond','good'],['marble, fair cond','fair'],['poor cond','poor'],['granite','unknown']]) {
   await c.query(`UPDATE north_hills_ocr_entries SET source_entry=jsonb_set(source_entry,'{descriptor}',to_jsonb($2::text))
    WHERE id IN (SELECT entry_id FROM north_hills_ocr_entry_headstone_links WHERE headstone_uuid=$1 AND status='linked')`,[linked.id,descriptor]);
   const result=(await c.query("SELECT c.code FROM monument_inspections i JOIN headstone_condition_types c ON c.id=i.condition_type_id WHERE i.headstone_uuid=$1 AND i.origin_key='nhg'",[linked.id])).rows[0];
   assert.equal(result.code,code);
  }

  await c.query("UPDATE headstones SET condition_notes='Later visit corrected' WHERE id=$1",[marker.id]);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM monument_inspections WHERE headstone_uuid=$1 AND origin_key='field:2027-01-05'",[marker.id])).rows[0].n,1);
  const newMarker=(await c.query("SELECT h.id FROM headstones h WHERE h.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM monument_inspections i WHERE i.headstone_uuid=h.id AND i.source_type='nhg') LIMIT 1")).rows[0];
  assert.ok(newMarker);assert.equal((await c.query("SELECT count(*)::int AS n FROM monument_inspections WHERE headstone_uuid=$1 AND source_type='nhg'",[newMarker.id])).rows[0].n,0);
 } finally {await c.query('ROLLBACK');await c.end();}
});
