import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
const sql=await readFile(new URL('../db/changelog/changes/461-align-section-e-gravesites-northeast.sql',import.meta.url),'utf8');
async function fixture(run){const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();try{
 await c.query('BEGIN');for(const t of ['cemeteries','gravesites','headstones'])await c.query(`CREATE TEMP TABLE ${t}(LIKE public.${t} INCLUDING ALL) ON COMMIT DROP`);
 const {rows:[cem]}=await c.query("INSERT INTO cemeteries(name,facility_id,geometry)VALUES('Trinity','1',ST_Multi(ST_MakeEnvelope(-80.09,40.60,-80.07,40.61,4326))) RETURNING id");
 for(const [i,section,offset] of [[1,'E',0],[2,'E',0.0001],[3,'D',0.0003]]){
  const {rows:[g]}=await c.query(`INSERT INTO gravesites(cemetery_id,section_id,grave_id,gravesite_id,status_type_id,geometry,width_feet,length_feet)
   VALUES($1,$2,$3,$4,gen_random_uuid(),ST_Multi(ST_MakeEnvelope(-80.08035+$5,40.60179,-80.08032+$5,40.601801,4326)),4,10) RETURNING *`,[cem.id,section,String(i),`TEST-${i}`,offset]);
  await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
   VALUES($1,$2,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint($3,40.6017955),4326))`,[`MARKER-${i}`,g.id,-80.080335+offset]);
 }
 await run(c);
}finally{await c.query('ROLLBACK');await c.end();}}
test('E graves face northeast with fixed monuments at southwest edge midpoints and preserved sizes',async()=>{await fixture(async c=>{
 const beforeMarkers=(await c.query('SELECT * FROM headstones ORDER BY id')).rows;
 const beforeOther=(await c.query("SELECT * FROM gravesites WHERE section_id<>'E' ORDER BY id")).rows;
 const before=(await c.query("SELECT id,geometry,ST_Area(geometry::geography) area,width_feet,length_feet FROM gravesites WHERE section_id='E' ORDER BY id")).rows;
 await c.query(sql);
 assert.deepEqual((await c.query('SELECT * FROM headstones ORDER BY id')).rows,beforeMarkers);
 assert.deepEqual((await c.query("SELECT * FROM gravesites WHERE section_id<>'E' ORDER BY id")).rows,beforeOther);
 for(const old of before){const {rows:[g]}=await c.query(`SELECT g.*,ST_Area(g.geometry::geography) area,
  degrees(ST_Azimuth(h.geometry::geography,ST_Centroid(g.geometry)::geography)) bearing,
  ST_Distance(h.geometry::geography,ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),1)::geography) endpoint1,
  ST_Distance(h.geometry::geography,ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),2)::geography) endpoint2,
  ST_Distance(h.geometry::geography,ST_MakeLine(ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),1),ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),2))::geography) edge_distance
  FROM gravesites g JOIN headstones h ON h.gravesite_uuid=g.id WHERE g.id=$1`,[old.id]);
  assert.ok(Math.abs(g.bearing-45)<0.01);assert.ok(Math.abs(g.area-old.area)<0.001);
  assert.ok(Math.abs(g.endpoint1-g.endpoint2)<0.001);assert.ok(g.edge_distance<0.001);
  assert.equal(g.width_feet,old.width_feet);assert.equal(g.length_feet,old.length_feet);assert.equal(g.geometry_confidence,'estimated');
 }
});});
test('missing or ambiguous monument anchors block before edits',async()=>{for(const setup of ["UPDATE headstones SET geometry=NULL WHERE headstone_id='MARKER-1'", "INSERT INTO headstones SELECT (jsonb_populate_record(NULL::headstones,to_jsonb(h)||jsonb_build_object('id',gen_random_uuid(),'headstone_id','EXTRA'))).* FROM headstones h WHERE headstone_id='MARKER-1'"]){await fixture(async c=>{
 await c.query(setup);const before=(await c.query('SELECT * FROM gravesites ORDER BY id')).rows;await c.query('SAVEPOINT correction');await assert.rejects(c.query(sql),/Migration prerequisite failed/);await c.query('ROLLBACK TO SAVEPOINT correction');assert.deepEqual((await c.query('SELECT * FROM gravesites ORDER BY id')).rows,before);
});}});
test('no imported E graves leaves records unchanged',async()=>{await fixture(async c=>{await c.query("UPDATE gravesites SET section_id='D'");const before=(await c.query('SELECT * FROM gravesites ORDER BY id')).rows;await c.query(sql);assert.deepEqual((await c.query('SELECT * FROM gravesites ORDER BY id')).rows,before);});});
