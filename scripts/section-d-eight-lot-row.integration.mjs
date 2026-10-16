import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/464-create-section-d-eight-lot-row.sql',import.meta.url),'utf8');
async function fixture(run){
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{
  await c.query('BEGIN');
  for(const t of ['lots','sections'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING ALL) ON COMMIT DROP`);
  const cemetery='00000000-0000-0000-0000-000000000001';
  await c.query("INSERT INTO sections(cemetery_id,name,facility_id,geometry) VALUES($1,'D','1',ST_Multi(ST_MakeEnvelope(-80.09,40.60,-80.07,40.61,4326)))",[cemetery]);
  for(const [i,id] of ['38','47','58','67','68','77'].entries()){
   await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
    VALUES($1,'1','D',$2,16.36,16,ST_Multi(ST_MakeEnvelope(-80.08012929117181-($3+1)*0.00005890322122,40.601477080274435,-80.08012929117181-$3*0.00005890322122,40.6015209971254,4326)))`,[cemetery,id,i]);
  }
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('eight lots preserve existing data, six-foot gap, eastern extension and restrictions',async()=>fixture(async c=>{
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 await c.query(sql);
 const added=(await c.query("SELECT * FROM lots WHERE lot_id NOT IN ('38','47','58','67','68','77') ORDER BY ST_X(ST_Centroid(geometry)) DESC")).rows;
 assert.deepEqual(added.map(r=>r.name),['D-28','D-29','D-37','D-48','D-57','D-TEMP-01','D-TEMP-02','D-TEMP-03']);
 assert.deepEqual((await c.query("SELECT * FROM lots WHERE lot_id IN ('38','47','58','67','68','77') ORDER BY id")).rows,before);
 const anchor=before.find(r=>r.lot_id==='38');
 for(const [i,row] of added.entries()){
  assert.equal(row.width_feet,anchor.width_feet);assert.equal(row.length_feet,anchor.length_feet);
  assert.equal(row.burial_use_status,i>=5?'non_burial':'standard');
  if(i>=5)assert.match(row.burial_use_notes,/no official lot number/);
  const {rows:[m]}=await c.query(`SELECT
   ST_XMin($1::geometry)-ST_XMin($2::geometry) dx,
   ST_XMax($2::geometry)-ST_XMin($2::geometry) w,
   ST_Distance(ST_SetSRID(ST_MakePoint(ST_XMax($2::geometry),ST_YMax($2::geometry)),4326)::geography,
     ST_SetSRID(ST_MakePoint(ST_XMax($2::geometry),ST_YMin($1::geometry)),4326)::geography)/0.3048 gap,
   ST_Equals(ST_Translate($1::geometry,ST_XMin($2::geometry)-ST_XMin($1::geometry),
    ST_YMin($2::geometry)-ST_YMin($1::geometry)),$2::geometry) same_shape`,[row.geometry,anchor.geometry]);
  assert.ok(Math.abs(m.dx-(2-i)*m.w)<1e-12);assert.ok(Math.abs(m.gap-6)<0.0001);assert.ok(m.same_shape);
 }
}));
test('existing destination prevents insertion',async()=>fixture(async c=>{
 await c.query("UPDATE lots SET lot_id='28' WHERE lot_id='77'");
 await assert.rejects(c.query(sql),/Migration 464/);
}));
test('absent imported reference row is a no-op',async()=>fixture(async c=>{
 await c.query('DELETE FROM lots');await c.query(sql);
 assert.equal((await c.query('SELECT count(*)::int n FROM lots')).rows[0].n,0);
}));
test('one-foot westward revision preserves all row properties and existing lots',async()=>fixture(async c=>{
 await c.query(sql);
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 const shift=await readFile(new URL('../db/changelog/changes/465-shift-section-d-eight-lot-row-west.sql',import.meta.url),'utf8');
 await c.query(shift);
 const after=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 for(const [i,row] of after.entries()){
  const old=before[i];
  if(['38','47','58','67','68','77'].includes(old.lot_id)){assert.deepEqual(row,old);continue;}
  const {rows:[m]}=await c.query(`SELECT
    ST_Distance(ST_Centroid($1::geometry)::geography,ST_Centroid($2::geometry)::geography)/0.3048 feet,
    ST_YMin($1::geometry)=ST_YMin($2::geometry) AND ST_YMax($1::geometry)=ST_YMax($2::geometry) same_latitudes,
    ST_XMin($1::geometry)<ST_XMin($2::geometry) west,
    ST_Equals(ST_Translate($1::geometry,ST_XMin($2::geometry)-ST_XMin($1::geometry),0),$2::geometry) same_shape`,[row.geometry,old.geometry]);
  assert.ok(Math.abs(m.feet-1)<0.0001);assert.ok(m.same_latitudes&&m.west&&m.same_shape);
  for(const key of ['geometry','updated_at','geometry_notes'])row[key]=old[key];
  assert.deepEqual(row,old);
 }
}));
