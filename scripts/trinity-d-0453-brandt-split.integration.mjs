import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
const migration = await readFile(new URL("../db/changelog/changes/437-split-d-0453-brandt-gravesites.sql", import.meta.url), "utf8");
async function fixture(run) {
  const client = new pg.Client(integrationAdminDatabase(loadApiConfig()));
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const table of ["gravesites", "headstones", "burials", "headstone_burials", "headstone_gravesites"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    const { rows: [grave] } = await client.query(`INSERT INTO gravesites
      (cemetery_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry,width_feet,length_feet)
      VALUES(gen_random_uuid(),'D','0453','TLC-GPS-0453','Philip Brandt',gen_random_uuid(),
      ST_Multi(ST_MakeEnvelope(-80.08012882,40.60167442,-80.080092809,40.6016854,4326)),4,10) RETURNING *`);
    const { rows: [marker] } = await client.query(`INSERT INTO headstones
      (headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry,faces)
      VALUES('TLC-HS-0453',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
        ST_SetSRID(ST_MakePoint(-80.080128075,40.601679612),4326),
        '[{"id":"original-face","label":"Front","designNotes":"Bust","burialIds":[],"mediaAssetIds":[]}]') RETURNING *`, [grave.id]);
    for (const first of ["Philip", "Regina, Elizabeth"]) {
      const { rows: [burial] } = await client.query(`INSERT INTO burials
        (gravesite_uuid,gravesite_id,first_name,last_name,full_name,interment_type_id,burial_record_status_type_id)
        VALUES($1,'TLC-GPS-0453',$2::text,'Brandt',$2::text||' Brandt',gen_random_uuid(),gen_random_uuid()) RETURNING id`, [grave.id,first]);
      await client.query("INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES($1,$2)",[marker.id,burial.id]);
    }
    await client.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'primary')",[marker.id,grave.id]);
    await run(client,{grave,marker});
  } finally { await client.query("ROLLBACK"); await client.end(); }
}
test("Brandt split preserves Philip and marker, creates measured north graves, and separates people", async () => {
  await fixture(async (c,{grave,marker}) => {
    const originalBurials=(await c.query("SELECT * FROM burials ORDER BY first_name")).rows;
    await c.query(migration);
    assert.deepEqual((await c.query("SELECT * FROM headstones")).rows,[marker]);
    assert.deepEqual((await c.query("SELECT * FROM gravesites WHERE id=$1",[grave.id])).rows,[grave]);
    const graves=(await c.query(`SELECT grave_id,id,name,ST_Y(ST_Centroid(geometry)) latitude,
      ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),1)::geography,
        ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),2)::geography)/0.3048 length,
      ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),2)::geography,
        ST_PointN(ST_ExteriorRing(ST_GeometryN(geometry,1)),3)::geography)/0.3048 width
      FROM gravesites ORDER BY grave_id`)).rows;
    assert.deepEqual(graves.map(g=>g.name),["Philip Brandt","Regina Brandt","Elizabeth Brandt"]);
    assert.ok(graves[2].latitude>graves[1].latitude && graves[1].latitude>graves[0].latitude);
    for (const g of graves.slice(1)) { assert.ok(Math.abs(g.length-10)<0.001); assert.ok(Math.abs(g.width-4)<0.001); }
    const burials=(await c.query("SELECT * FROM burials ORDER BY first_name")).rows;
    assert.equal(burials.length,3);
    assert.deepEqual(burials.find(b=>b.first_name==="Philip"),originalBurials[0]);
    const regina=burials.find(b=>b.first_name==="Regina"),elizabeth=burials.find(b=>b.first_name==="Elizabeth");
    assert.equal(regina.id,originalBurials[1].id);
    assert.equal(regina.gravesite_uuid,graves[1].id);assert.equal(elizabeth.gravesite_uuid,graves[2].id);
    assert.equal(regina.birth_date_text,"1818-08-29");assert.equal(elizabeth.death_date_text,"1927-10-17");
    assert.equal(regina.source_properties.Brandt0453Split.originalCombinedBurial.full_name,"Regina, Elizabeth Brandt");
    assert.equal((await c.query("SELECT count(*)::int n FROM headstone_burials")).rows[0].n,3);
    assert.equal((await c.query("SELECT count(*)::int n FROM headstone_gravesites")).rows[0].n,3);
  });
});
test("Brandt correction refuses identifier collisions and missing combined records", async () => {
  for (const sql of ["UPDATE burials SET full_name='Unknown' WHERE first_name='Regina, Elizabeth'",
    "INSERT INTO gravesites SELECT (jsonb_populate_record(NULL::gravesites,to_jsonb(g)||jsonb_build_object('id',gen_random_uuid(),'grave_id','0453A','gravesite_id','TLC-GPS-0453-01'))).* FROM gravesites g"]) {
    await fixture(async c => { await c.query(sql);await c.query("SAVEPOINT change");await assert.rejects(c.query(migration),/Migration prerequisite failed/);await c.query("ROLLBACK TO SAVEPOINT change"); });
  }
});
test("Brandt correction does nothing in environments without the source grave",async()=>{
  await fixture(async c=>{await c.query("DELETE FROM gravesites");await c.query(migration);assert.equal((await c.query("SELECT count(*)::int n FROM burials")).rows[0].n,2);});
});
