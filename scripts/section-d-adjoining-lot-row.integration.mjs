import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/466-create-section-d-adjoining-lot-row.sql',import.meta.url),'utf8');
async function fixture(run){
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{
  await c.query('BEGIN');
  for(const t of ['lots','sections'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING ALL) ON COMMIT DROP`);
  const cemetery='00000000-0000-0000-0000-000000000001';
  await c.query("INSERT INTO sections(cemetery_id,name,facility_id,geometry) VALUES($1,'D','1',ST_Multi(ST_MakeEnvelope(-80.09,40.60,-80.07,40.61,4326)))",[cemetery]);
  for(const [i,id] of ['28','29','37','48','57','TMP01','TMP02','TMP03'].entries()){
   await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
    VALUES($1,'1','D',$2,16.36,16,ST_Multi(ST_MakeEnvelope(-80.08012929117181-($3+1)*0.00005890322122,40.601477080274435,-80.08012929117181-$3*0.00005890322122,40.6015209971254,4326)))`,[cemetery,id,i]);
  }
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('eight lots preserve existing data, shared border, alignment and restrictions',async()=>fixture(async c=>{
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 await c.query(sql);
 const added=(await c.query("SELECT * FROM lots WHERE lot_id NOT IN ('28','29','37','48','57','TMP01','TMP02','TMP03') ORDER BY ST_X(ST_Centroid(geometry)) DESC")).rows;
 assert.deepEqual(added.map(r=>r.name),['D-27','D-30','D-36','D-49','D-56','D-TEMP-04','D-TEMP-05','D-TEMP-06']);
 assert.deepEqual((await c.query("SELECT * FROM lots WHERE lot_id IN ('28','29','37','48','57','TMP01','TMP02','TMP03') ORDER BY id")).rows,before);
 const anchor=before.find(r=>r.lot_id==='28');
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
  assert.ok(Math.abs(m.dx+i*m.w)<1e-12);assert.ok(Math.abs(m.gap)<0.0001);assert.ok(m.same_shape);
 }
}));
test('existing destination prevents insertion',async()=>fixture(async c=>{
 await c.query("UPDATE lots SET lot_id='27' WHERE lot_id='TMP03'");
 await assert.rejects(c.query(sql),/Migration 466/);
}));
test('absent imported reference row is a no-op',async()=>fixture(async c=>{
 await c.query('DELETE FROM lots');await c.query(sql);
 assert.equal((await c.query('SELECT count(*)::int n FROM lots')).rows[0].n,0);
}));
test('paired-row shift contains the fixed marker and preserves all sixteen lots',async()=>fixture(async c=>{
 await c.query(sql);
 await c.query('CREATE TEMP TABLE headstones(LIKE public.headstones INCLUDING ALL) ON COMMIT DROP');
 await c.query(`INSERT INTO headstones(headstone_id,marker_type_id,material_type_id,condition_type_id,geometry)
 SELECT 'TLC-HS-0478',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
 ST_SetSRID(ST_MakePoint(ST_XMin(geometry)-0.0000005435,ST_Y(ST_Centroid(geometry))),4326)
 FROM lots WHERE lot_id='49'`);
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 const markers=(await c.query('SELECT * FROM headstones ORDER BY id')).rows;
 const shift=await readFile(new URL('../db/changelog/changes/467-shift-section-d-paired-rows-west.sql',import.meta.url),'utf8');
 await c.query(shift);
 assert.deepEqual((await c.query('SELECT * FROM headstones ORDER BY id')).rows,markers);
 const after=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 assert.equal(after.length,16);
 for(const [i,row] of after.entries()){
  const old=before[i];
  const {rows:[m]}=await c.query(`SELECT
   ST_Distance(ST_Centroid($1::geometry)::geography,ST_Centroid($2::geometry)::geography)/0.3048 feet,
   ST_YMin($1::geometry)=ST_YMin($2::geometry) AND ST_YMax($1::geometry)=ST_YMax($2::geometry) same_latitudes,
   ST_XMin($1::geometry)<ST_XMin($2::geometry) west,
   ST_Equals(ST_Translate($1::geometry,ST_XMin($2::geometry)-ST_XMin($1::geometry),0),$2::geometry) same_shape`,[row.geometry,old.geometry]);
  assert.ok(Math.abs(m.feet-2)<0.0001);assert.ok(m.same_latitudes&&m.west&&m.same_shape);
  for(const k of ['geometry','updated_at','geometry_notes'])row[k]=old[k];assert.deepEqual(row,old);
 }
 assert.ok((await c.query("SELECT ST_Contains(l.geometry,h.geometry) contained FROM lots l CROSS JOIN headstones h WHERE l.lot_id='49'")).rows[0].contained);
}));
