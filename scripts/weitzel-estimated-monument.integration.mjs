import {createLegacyTableFixture} from "./lib/legacy-table-fixtures.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
const migration=await readFile(new URL('../db/changelog/changes/458-add-weitzel-estimated-monument.sql',import.meta.url),'utf8');
async function fixture(run){
  const c=new pg.Client(integrationAdminDatabase(loadApiConfig()));await c.connect();
  try{
    await c.query('BEGIN');
    for(const table of ['gravesites','headstones']) await createLegacyTableFixture(c, table);
    // Recreate the column that existed when migration 458 was authored.
    await c.query('ALTER TABLE pg_temp.headstones ADD COLUMN back_description text');
    const {rows:[grave]}=await c.query(`INSERT INTO gravesites(cemetery_id,section_id,grave_id,gravesite_id,status_type_id,geometry)
      VALUES(gen_random_uuid(),'D','0500','TLC-GPS-0500',gen_random_uuid(),ST_Multi(ST_MakeEnvelope(-80.080523,40.60157751,-80.08048699,40.60158849,4326))) RETURNING *`);
    const {rows:[marker]}=await c.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
      VALUES('TLC-HS-0500',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint(-80.08052225452694,40.60158270179616),4326)) RETURNING *`,[grave.id]);
    await run(c,{grave,marker});
  }finally{await c.query('ROLLBACK');await c.end();}
}
test('estimated monument is eight feet north with provenance; existing monument and gravesite stay unchanged',async()=>{
  await fixture(async(c,{grave,marker})=>{
    await c.query(migration);
    assert.deepEqual((await c.query('SELECT * FROM headstones WHERE id=$1',[marker.id])).rows,[marker]);
    assert.deepEqual((await c.query('SELECT * FROM gravesites')).rows,[grave]);
    const {rows:[added]}=await c.query(`SELECT h.*,ST_Distance(h.geometry::geography,r.geometry::geography)/0.3048 distance_ft,
      ST_Y(h.geometry)>ST_Y(r.geometry) is_north FROM headstones h CROSS JOIN headstones r
      WHERE h.headstone_id='TLC-HS-0577' AND r.headstone_id='TLC-HS-0500'`);
    assert.ok(Math.abs(added.distance_ft-8)<0.001);assert.equal(added.is_north,true);
    assert.equal(added.gravesite_uuid,null);assert.equal(added.data_confidence,'low');assert.equal(added.review_status,'needs_review');
    assert.match(added.review_notes,/ESTIMATED LOCATION/);assert.match(added.inscription,/JERRY LEE/);assert.match(added.inscription,/SHIRLEY JANE/);
    assert.equal(added.source_properties.EstimatedPosition.surveyed,false);assert.equal(added.source_properties.Photos.length,3);
  });
});
test('missing geometry, duplicate identifiers and name collisions fail without changing records',async()=>{
  for(const setup of ["UPDATE headstones SET geometry=NULL", "UPDATE headstones SET headstone_id='TLC-HS-0577' WHERE headstone_id='TLC-HS-0500'", "UPDATE headstones SET inscription='WEITZEL'"]){
    await fixture(async(c)=>{
      await c.query(setup);
      // Keep an active reference for the identifier-collision case.
      if(setup.includes('0577')) await c.query(`INSERT INTO headstones SELECT (jsonb_populate_record(NULL::headstones,to_jsonb(h)||jsonb_build_object('id',gen_random_uuid(),'headstone_id','TLC-HS-0500'))).* FROM headstones h`);
      const before=(await c.query('SELECT * FROM headstones ORDER BY id')).rows;
      await c.query('SAVEPOINT correction');await assert.rejects(c.query(migration),/Migration prerequisite failed/);await c.query('ROLLBACK TO SAVEPOINT correction');
      assert.deepEqual((await c.query('SELECT * FROM headstones ORDER BY id')).rows,before);
    });
  }
});
test('environments without the reference monument are unchanged',async()=>{
  await fixture(async(c,{grave})=>{await c.query('DELETE FROM headstones');await c.query(migration);assert.equal((await c.query('SELECT count(*)::int n FROM headstones')).rows[0].n,0);assert.deepEqual((await c.query('SELECT * FROM gravesites')).rows,[grave]);});
});
