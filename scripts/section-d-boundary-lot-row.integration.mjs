import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/470-create-section-d-boundary-lot-row.sql',import.meta.url),'utf8');
async function fixture(run){
 const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
 try{
  await c.query('BEGIN');
  for(const t of ['lots','sections','cemeteries'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING ALL) ON COMMIT DROP`);
  const cemetery='00000000-0000-0000-0000-000000000001';
  await c.query("INSERT INTO sections(cemetery_id,name,facility_id,geometry) VALUES($1,'D','1',ST_Multi(ST_MakeEnvelope(-80.09,40.60,-80.07,40.61,4326)))",[cemetery]);
  for(const [i,id] of ['25','32','34','51','54','TMP10','TMP11','TMP12'].entries()){
   await c.query(`INSERT INTO lots(cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
    VALUES($1,'1','D',$2,16.36,16,ST_Multi(ST_MakeEnvelope(-80.08012929117181-($3+1)*0.00005890322122,40.601477080274435,-80.08012929117181-$3*0.00005890322122,40.6015209971254,4326)))`,[cemetery,id,i]);
  }
  await c.query(`WITH a AS (SELECT ST_XMax(geometry) e,ST_XMin(geometry) west,ST_YMin(geometry) s,
   ST_XMax(geometry)-ST_XMin(geometry) w,ST_YMax(geometry)-ST_YMin(geometry) h,
   ST_Y(ST_Project(ST_SetSRID(ST_MakePoint(ST_XMax(geometry),ST_YMax(geometry)),4326)::geography,6*0.3048,0)::geometry) ns
   FROM lots WHERE lot_id='25')
   INSERT INTO cemeteries(id,name,facility_id,geometry) SELECT $1,'Trinity','1',
   ST_Multi(ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
    ST_MakePoint(west-.01,s-.01),ST_MakePoint(e+2*w,s-.01),ST_MakePoint(e+2*w,ns),
    ST_MakePoint(e-1.7*w,ns+h),ST_MakePoint(e-1.7*w,ns+h+.01),
    ST_MakePoint(west-.01,ns+h+.01),ST_MakePoint(west-.01,s-.01)])),4326)) FROM a`,[cemetery]);
  await run(c);
 }finally{await c.query('ROLLBACK');await c.end();}
}
test('eight lots have correct order, clipped eastern pair, full D-33 and western restrictions',async()=>fixture(async c=>{
 const before=(await c.query('SELECT * FROM lots ORDER BY id')).rows;await c.query(sql);
 assert.deepEqual((await c.query("SELECT * FROM lots WHERE lot_id IN ('25','32','34','51','54','TMP10','TMP11','TMP12') ORDER BY id")).rows,before);
 const {rows}=await c.query(`SELECT l.*,ST_CoveredBy(l.geometry,ST_Buffer(c.geometry,1e-12)) covered,
 ST_Area(l.geometry::geography) area FROM lots l JOIN cemeteries c ON c.id=l.cemetery_id
 WHERE l.lot_id IN ('TMP13','TMP14','33','5','53','TMP15','TMP16','TMP17')
 ORDER BY ST_X(ST_Centroid(l.geometry)) DESC`);
 assert.deepEqual(rows.map(x=>x.lot_id),['TMP13','TMP14','33','5','53','TMP15','TMP16','TMP17']);
 for(const [i,row] of rows.entries()){
  assert.ok(row.covered);assert.equal(row.burial_use_status,i>=5?'non_burial':'standard');
  assert.equal(row.width_feet,'16.36');assert.equal(row.length_feet,'16.00');
  if(i<2)assert.ok(row.area<rows[2].area-0.01);else assert.ok(Math.abs(row.area-rows[2].area)<0.001);
 }
 const {rows:[m]}=await c.query(`SELECT ST_Distance(
 ST_SetSRID(ST_MakePoint(ST_XMin(a.geometry),ST_YMax(a.geometry)),4326)::geography,
 ST_SetSRID(ST_MakePoint(ST_XMin(a.geometry),ST_YMin(n.geometry)),4326)::geography)/0.3048 gap,
 ST_Distance(ST_Centroid(a.geometry)::geography,
 ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(n.geometry))+2*(ST_XMax(a.geometry)-ST_XMin(a.geometry)),ST_Y(ST_Centroid(a.geometry))),4326)::geography)/0.3048 shift
 FROM lots a CROSS JOIN lots n WHERE a.lot_id='25' AND n.lot_id='33'`);
 assert.ok(Math.abs(m.gap-6)<0.0001);assert.ok(Math.abs(m.shift-6.7)<0.0001);
}));
test('occupied identifiers and a boundary clipping D-33 block insertion',async()=>{
 for(const setup of ["UPDATE lots SET lot_id='33' WHERE lot_id='TMP12'",
 "UPDATE cemeteries SET geometry=ST_Multi(ST_MakeEnvelope(-80.081,40.60,-80.0804,40.61,4326))"]){
  await fixture(async c=>{await c.query(setup);await assert.rejects(c.query(sql),/Migration 470/);});
 }
});
test('missing imported row is a no-op',async()=>fixture(async c=>{
 await c.query('DELETE FROM lots');await c.query(sql);
 assert.equal((await c.query('SELECT count(*)::int n FROM lots')).rows[0].n,0);
}));
