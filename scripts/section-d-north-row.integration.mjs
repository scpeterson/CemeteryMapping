import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/462-create-section-d-north-lot-row.sql',import.meta.url),'utf8');
async function fixture(run){
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{
  await c.query('BEGIN');
  for(const t of ['lots','sections'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING ALL) ON COMMIT DROP`);
  const cemetery='00000000-0000-0000-0000-000000000001';
  await c.query("INSERT INTO sections(cemetery_id,name,facility_id,geometry) VALUES($1,'D','1',ST_Multi(ST_MakeEnvelope(-80.09,40.60,-80.07,40.61,4326)))",[cemetery]);
  for(const [i,id] of ['39A','46A','59','66','69','76A'].entries()){
   await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
    VALUES($1,'1','C',$2,16.36,16,ST_Multi(ST_MakeEnvelope(-80.08012929117181-($3+1)*0.00005890322122,40.601477080274435,-80.08012929117181-$3*0.00005890322122,40.6015209971254,4326)))`,[cemetery,id,i]);
  }
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('six matching lots preserve source row, order, eleven-foot gap and east alignment',async()=>fixture(async c=>{
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 await c.query(sql);
 assert.deepEqual((await c.query("SELECT * FROM lots WHERE section_id='C' ORDER BY id")).rows,before);
 const rows=(await c.query(`SELECT d.*,ST_XMax(d.geometry) east,ST_YMin(d.geometry) south,
  ST_Area(d.geometry::geography) area FROM lots d WHERE section_id='D' ORDER BY ST_X(ST_Centroid(geometry)) DESC`)).rows;
 assert.deepEqual(rows.map(r=>r.lot_id),['38','47','58','67','68','77']);
 for(const [i,row] of rows.entries()){
  const source=before.find(r=>r.lot_id===['39A','46A','59','66','69','76A'][i]);
  assert.equal(row.width_feet,source.width_feet);assert.equal(row.length_feet,source.length_feet);
  assert.equal(row.geometry_confidence,'estimated');
 }
 const {rows:[metrics]}=await c.query(`SELECT
 ST_XMax(d.geometry)-ST_XMax(s.geometry) east_delta,
 ST_Distance(ST_SetSRID(ST_MakePoint(ST_XMax(s.geometry),ST_YMax(s.geometry)),4326)::geography,
 ST_SetSRID(ST_MakePoint(ST_XMax(d.geometry),ST_YMin(d.geometry)),4326)::geography)/0.3048 gap,
 ST_Equals(ST_Translate(d.geometry,0,ST_YMin(s.geometry)-ST_YMin(d.geometry)),s.geometry) same_shape
 FROM lots d CROSS JOIN lots s WHERE d.section_id='D' AND d.lot_id='38' AND s.section_id='C' AND s.lot_id='39A'`);
 assert.equal(metrics.east_delta,0);assert.ok(Math.abs(metrics.gap-11)<0.0001);assert.equal(metrics.same_shape,true);
}));
test('existing destination numbers block changes',async()=>fixture(async c=>{
 await c.query("UPDATE lots SET section_id='D',lot_id='38' WHERE lot_id='76A'");
 await assert.rejects(c.query(sql),/Migration prerequisite failed/);
}));
test('absent imported row is a no-op',async()=>fixture(async c=>{
 await c.query('DELETE FROM lots');await c.query(sql);
 assert.equal((await c.query('SELECT count(*)::int n FROM lots')).rows[0].n,0);
}));
test('westward revision shifts only the new row two feet and preserves its shape',async()=>fixture(async c=>{
 await c.query(sql);
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;
 const shiftSql=await readFile(new URL('../db/changelog/changes/463-shift-section-d-north-row-west.sql',import.meta.url),'utf8');
 await c.query(shiftSql);
 assert.deepEqual((await c.query("SELECT * FROM lots WHERE section_id='C' ORDER BY id")).rows,before.filter(r=>r.section_id==='C'));
 for(const old of before.filter(r=>r.section_id==='D')){
  const {rows:[r]}=await c.query(`SELECT
   ST_Distance(ST_Centroid(geometry)::geography,ST_Centroid($2::geometry)::geography)/0.3048 feet,
   ST_YMin(geometry)=ST_YMin($2::geometry) AND ST_YMax(geometry)=ST_YMax($2::geometry) same_latitudes,
   ST_X(ST_Centroid(geometry))<ST_X(ST_Centroid($2::geometry)) west,
   ST_Equals(ST_Translate(geometry,ST_XMin($2::geometry)-ST_XMin(geometry),0),$2::geometry) same_shape
   FROM lots WHERE id=$1`,[old.id,old.geometry]);
  assert.ok(Math.abs(r.feet-2)<0.0001);assert.ok(r.same_latitudes);assert.ok(r.west);assert.ok(r.same_shape);
 }
}));
