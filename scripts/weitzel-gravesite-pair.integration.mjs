import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
const migration=await readFile(new URL('../db/changelog/changes/459-create-weitzel-estimated-gravesite-pair.sql',import.meta.url),'utf8');
async function fixture(run){
  const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
  try{
    await c.query('BEGIN');
    for(const table of ['gravesites','headstones','headstone_gravesites','headstone_burials','burials']) await c.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    const {rows:[grave]}=await c.query(`INSERT INTO gravesites(cemetery_id,section_id,grave_id,gravesite_id,status_type_id,geometry)
      VALUES(gen_random_uuid(),'D','0500','TLC-GPS-0500',gen_random_uuid(),ST_Multi(ST_MakeEnvelope(-80.080523,40.60157751,-80.08048699,40.60158849,4326))) RETURNING *`);
    await c.query(`INSERT INTO gravesites(cemetery_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry)
      VALUES($1,'D','0500A','TLC-GPS-0500-01','Bonnie Louise Brant',gen_random_uuid(),ST_Multi(ST_MakeEnvelope(-80.080523,40.6015884896,-80.08048698855,40.60159946882,4326))),
      ($1,'D','0554','TLC-GPS-0554','Martha E Traut',gen_random_uuid(),ST_Multi(ST_MakeEnvelope(-80.08051321498,40.6016115839,-80.08048436502,40.6016225361,4326)))`,[grave.cemetery_id]);
    const {rows:[ref]}=await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
      VALUES('TLC-HS-0500',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint(-80.08052225452694,40.60158270179616),4326)) RETURNING *`,[grave.id]);
    const {rows:[marker]}=await c.query(`INSERT INTO headstones(headstone_id,marker_type_id,material_type_id,condition_type_id,geometry,inscription,source_properties)
      VALUES('TLC-HS-0577',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_Project($1::geography,8*0.3048,0)::geometry,'WEITZEL',
        '{"EstimatedPosition":{"surveyed":false,"distanceFeet":8},"Photos":[{"filename":"IMG_6597.HEIC"}]}') RETURNING *`,[ref.geometry]);
    await run(c,{ref,marker});
  }finally{await c.query('ROLLBACK');await c.end();}
}
test('approved pair retains neighbors and evidence, creates no burials and moves only the estimated monument',async()=>{
  await fixture(async(c,{ref,marker})=>{
    const before=(await c.query('SELECT * FROM gravesites ORDER BY id')).rows;
    await c.query(migration);
    for(const grave of before) assert.deepEqual((await c.query('SELECT * FROM gravesites WHERE id=$1',[grave.id])).rows,[grave]);
    assert.deepEqual((await c.query('SELECT * FROM headstones WHERE id=$1',[ref.id])).rows,[ref]);
    const {rows:pair}=await c.query(`SELECT g.*,ST_Y(ST_Centroid(geometry)) lat,
      ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),1)::geography,ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),2)::geography)/0.3048 length_ft,
      ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),2)::geography,ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),3)::geography)/0.3048 width_ft
      FROM gravesites g WHERE gravesite_id LIKE 'TLC-GPS-0577%' ORDER BY grave_id`);
    assert.deepEqual(pair.map(g=>g.name),['Jerry Lee Weitzel','Shirley Jane Weitzel']);assert.ok(pair[1].lat>pair[0].lat);
    for(const g of pair){assert.equal(g.geometry_confidence,'estimated');assert.ok(Math.abs(g.length_ft-10)<0.001);assert.ok(Math.abs(g.width_ft-4)<0.001);}
    const {rows:[updated]}=await c.query('SELECT * FROM headstones WHERE id=$1',[marker.id]);
    assert.equal(updated.gravesite_uuid,pair[0].id);assert.equal(updated.inscription,marker.inscription);
    assert.equal(updated.data_confidence,'low');assert.equal(updated.review_status,'needs_review');
    assert.deepEqual(updated.source_properties.Photos,marker.source_properties.Photos);
    assert.deepEqual(updated.source_properties.PreviousEstimatedPosition.estimate,marker.source_properties.EstimatedPosition);
    assert.equal(updated.source_properties.EstimatedPosition.northOffsetFeet,11);assert.equal(updated.source_properties.EstimatedPosition.westOffsetFeet,8);
    const {rows:[offset]}=await c.query(`SELECT ST_Distance(h.geometry::geography,ST_Project(ST_Project(r.geometry::geography,11*0.3048,0),8*0.3048,3*pi()/2)) error FROM headstones h CROSS JOIN headstones r WHERE h.id=$1 AND r.id=$2`,[marker.id,ref.id]);assert.ok(offset.error<0.001);
    assert.equal((await c.query('SELECT count(*)::int n FROM burials')).rows[0].n,0);
    assert.equal((await c.query('SELECT count(*)::int n FROM headstone_burials')).rows[0].n,0);
    const links=(await c.query('SELECT gravesite_uuid,relationship_type FROM headstone_gravesites ORDER BY relationship_type')).rows;
    assert.deepEqual(links,[{gravesite_uuid:pair[0].id,relationship_type:'primary'},{gravesite_uuid:pair[1].id,relationship_type:'spans'}]);
    const {rows:[overlap]}=await c.query(`SELECT max(ST_Area(ST_Intersection(a.geometry,b.geometry)::geography)) area FROM gravesites a JOIN gravesites b ON a.id<>b.id`);assert.ok(overlap.area<0.001);
  });
});
test('unexpected links, missing reference and overlapping/occupied graves reject before mutation',async()=>{
  for(const setup of ["UPDATE headstones SET geometry=NULL WHERE headstone_id='TLC-HS-0500'", "UPDATE headstones SET gravesite_uuid=(SELECT id FROM gravesites WHERE gravesite_id='TLC-GPS-0500') WHERE headstone_id='TLC-HS-0577'", "UPDATE gravesites SET gravesite_id='TLC-GPS-0577' WHERE gravesite_id='TLC-GPS-0554'", "UPDATE gravesites SET geometry=ST_Multi(ST_MakeEnvelope(-80.08056,40.60160,-80.08050,40.60163,4326)) WHERE gravesite_id='TLC-GPS-0554'"]){
    await fixture(async c=>{
      await c.query(setup);const before=(await c.query('SELECT * FROM headstones ORDER BY id')).rows;
      await c.query('SAVEPOINT correction');await assert.rejects(c.query(migration),/Migration prerequisite failed/);await c.query('ROLLBACK TO SAVEPOINT correction');
      assert.deepEqual((await c.query('SELECT * FROM headstones ORDER BY id')).rows,before);
    });
  }
});
test('no Weitzel marker leaves the database unchanged',async()=>{
  await fixture(async c=>{await c.query("DELETE FROM headstones WHERE headstone_id='TLC-HS-0577'");const before=(await c.query('SELECT * FROM gravesites ORDER BY id')).rows;await c.query(migration);assert.deepEqual((await c.query('SELECT * FROM gravesites ORDER BY id')).rows,before);});
});
