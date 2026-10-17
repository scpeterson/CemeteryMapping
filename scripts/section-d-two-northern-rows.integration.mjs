import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/468-create-section-d-two-northern-rows.sql',import.meta.url),'utf8');
async function fixture(run){
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{
  await c.query('BEGIN');
  for(const t of ['lots','sections'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING ALL) ON COMMIT DROP`);
  const cemetery='00000000-0000-0000-0000-000000000001';
  await c.query("INSERT INTO sections(cemetery_id,name,facility_id,geometry) VALUES($1,'D','1',ST_Multi(ST_MakeEnvelope(-80.09,40.60,-80.07,40.61,4326)))",[cemetery]);
  for(const [i,id] of ['27','30','36','49','56','TMP04','TMP05','TMP06'].entries()){
   await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
    VALUES($1,'1','D',$2,16.36,16,ST_Multi(ST_MakeEnvelope(-80.08012929117181-($3+1)*0.00005890322122,40.601477080274435,-80.08012929117181-$3*0.00005890322122,40.6015209971254,4326)))`,[cemetery,id,i]);
  }
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('sixteen matching lots preserve alignment, gap, shared border, order and restrictions',async()=>fixture(async c=>{
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 await c.query(sql);
 assert.deepEqual((await c.query("SELECT * FROM lots WHERE lot_id IN ('27','30','36','49','56','TMP04','TMP05','TMP06') ORDER BY id")).rows,before);
 const names=[['26','31','35','50','55','TMP07','TMP08','TMP09'],['25','32','34','51','54','TMP10','TMP11','TMP12']];
 for(let r=0;r<2;r++){
  const rows=(await c.query('SELECT * FROM lots WHERE lot_id=ANY($1::text[]) ORDER BY ST_X(ST_Centroid(geometry)) DESC',[names[r]])).rows;
  assert.deepEqual(rows.map(x=>x.lot_id),names[r]);
  for(const [i,row] of rows.entries()){
   assert.equal(row.width_feet,'16.36');assert.equal(row.length_feet,'16.00');
   assert.equal(row.burial_use_status,i>=5?'non_burial':'standard');
   if(i>=5)assert.equal(row.name,'D-TEMP-'+row.lot_id.slice(3));
   const {rows:[m]}=await c.query(`SELECT
    ST_XMin(n.geometry)-ST_XMin(a.geometry) dx,
    ST_XMax(a.geometry)-ST_XMin(a.geometry) w,
    ST_YMin(n.geometry)-ST_YMax(a.geometry) dy,
    ST_YMax(a.geometry)-ST_YMin(a.geometry) h,
    ST_Y(ST_Project(ST_SetSRID(ST_MakePoint(ST_XMax(a.geometry),ST_YMax(a.geometry)),4326)::geography,6*0.3048,0)::geometry)-ST_YMax(a.geometry) gap,
    ST_Equals(ST_Translate(n.geometry,ST_XMin(a.geometry)-ST_XMin(n.geometry),
     ST_YMin(a.geometry)-ST_YMin(n.geometry)),a.geometry) same_shape
    FROM lots n CROSS JOIN lots a WHERE n.id=$1 AND a.lot_id='27'`,[row.id]);
   assert.ok(Math.abs(m.dx+i*m.w)<1e-12);assert.ok(Math.abs(m.dy-m.gap-r*m.h)<1e-12);assert.ok(m.same_shape);
  }
 }
}));
test('occupied numbers, incomplete source rows and overlaps block changes',async()=>{for(const setup of [
 "UPDATE lots SET lot_id='26' WHERE lot_id='TMP06'",
 "DELETE FROM lots WHERE lot_id='TMP06'",
 "INSERT INTO lots SELECT (jsonb_populate_record(NULL::lots,to_jsonb(l)||jsonb_build_object('id',gen_random_uuid(),'lot_id','OTHER','geometry',ST_AsEWKT(ST_Translate(geometry,0,0.000065))))).* FROM lots l WHERE lot_id='27'"
])await fixture(async c=>{
 await c.query(setup);await assert.rejects(c.query(sql),/Migration 468/);
});});
test('missing imported reference is a no-op',async()=>fixture(async c=>{
 await c.query('DELETE FROM lots');await c.query(sql);assert.equal((await c.query('SELECT count(*)::int n FROM lots')).rows[0].n,0);
}));
test('paired-row shift contains the fixed marker and preserves all sixteen lots',async()=>fixture(async c=>{
 await c.query(sql);
 await c.query('CREATE TEMP TABLE headstones(LIKE public.headstones INCLUDING ALL) ON COMMIT DROP');
 await c.query(`INSERT INTO headstones(headstone_id,marker_type_id,material_type_id,condition_type_id,geometry)
 SELECT 'TLC-HS-0445',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
 ST_SetSRID(ST_MakePoint(ST_XMin(geometry)-0.0000035909,ST_Y(ST_Centroid(geometry))),4326)
 FROM lots WHERE lot_id='26'`);
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 const markers=(await c.query('SELECT * FROM headstones ORDER BY id')).rows;
 const shift=await readFile(new URL('../db/changelog/changes/469-shift-section-d-northern-pair-west.sql',import.meta.url),'utf8');
 await c.query(shift);
 assert.deepEqual((await c.query('SELECT * FROM headstones ORDER BY id')).rows,markers);
 const after=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 assert.equal(after.length,24);
 for(const [i,row] of after.entries()){
  const old=before[i];
  if(['27','30','36','49','56','TMP04','TMP05','TMP06'].includes(old.lot_id)){assert.deepEqual(row,old);continue;}
  const {rows:[m]}=await c.query(`SELECT
   ST_Distance(ST_Centroid($1::geometry)::geography,ST_Centroid($2::geometry)::geography)/0.3048 feet,
   ST_YMin($1::geometry)=ST_YMin($2::geometry) AND ST_YMax($1::geometry)=ST_YMax($2::geometry) same_latitudes,
   ST_XMin($1::geometry)<ST_XMin($2::geometry) west,
   ST_Equals(ST_Translate($1::geometry,ST_XMin($2::geometry)-ST_XMin($1::geometry),0),$2::geometry) same_shape`,[row.geometry,old.geometry]);
  assert.ok(Math.abs(m.feet-2)<0.0001);assert.ok(m.same_latitudes&&m.west&&m.same_shape);
  for(const k of ['geometry','updated_at','geometry_notes'])row[k]=old[k];assert.deepEqual(row,old);
 }
 assert.ok((await c.query("SELECT ST_Contains(l.geometry,h.geometry) contained FROM lots l CROSS JOIN headstones h WHERE l.lot_id='26'")).rows[0].contained);
}));
