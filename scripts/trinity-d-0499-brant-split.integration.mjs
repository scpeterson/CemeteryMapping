import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

const migration = await readFile(new URL("../db/changelog/changes/456-split-d-0499-brant-gravesites.sql", import.meta.url), "utf8");

async function fixture(client) {
  // Real column types, defaults and uniqueness, isolated from maintained records.
  for (const table of ["gravesites", "headstones", "burials", "headstone_burials", "headstone_gravesites"]) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
  }
  const { rows: [grave] } = await client.query(`
    INSERT INTO gravesites (cemetery_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry)
    VALUES (gen_random_uuid(),'D','0499','TLC-GPS-0499','Clifford Chester Brant',gen_random_uuid(),
      ST_Multi(ST_MakeEnvelope(-80.08052221,40.60155913,-80.0804861986,40.60157011,4326))) RETURNING id`);
  const { rows: [marker] } = await client.query(`
    INSERT INTO headstones (headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
    VALUES ('TLC-HS-0499',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
      ST_SetSRID(ST_MakePoint(-80.080521464528,40.60156432179608),4326)) RETURNING *`, [grave.id]);
  for (const firstName of ["Clifford Chester", "Jacoueline Lois"]) {
    const { rows: [burial] } = await client.query(`
      INSERT INTO burials (gravesite_uuid,gravesite_id,first_name,last_name,full_name,interment_type_id,burial_record_status_type_id)
      VALUES ($1,'TLC-GPS-0499',$2::text,'Brant',$2::text || ' Brant',gen_random_uuid(),gen_random_uuid()) RETURNING id`, [grave.id, firstName]);
    await client.query("INSERT INTO headstone_burials (headstone_uuid,burial_uuid) VALUES ($1,$2)", [marker.id, burial.id]);
  }
  await client.query("INSERT INTO headstone_gravesites (headstone_uuid,gravesite_uuid,relationship_type) VALUES ($1,$2,'primary')", [marker.id, grave.id]);
  return { grave, marker };
}

async function withFixture(run) {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const records = await fixture(client);
    await run(client, records);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

test("Brant split keeps the marker fixed between two measured 4-by-10-foot graves and preserves burial links", async () => {
  await withFixture(async (client, { grave, marker }) => {
    const beforeLinks = (await client.query("SELECT * FROM headstone_burials ORDER BY burial_uuid")).rows;
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT * FROM headstones")).rows, [marker]);
    assert.deepEqual((await client.query("SELECT * FROM headstone_burials ORDER BY burial_uuid")).rows, beforeLinks);
    const { rows: graves } = await client.query(`
      SELECT g.*, ST_Y(ST_Centroid(g.geometry)) AS latitude,
        ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),1)::geography,
          ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),2)::geography)/0.3048 AS east_length,
        ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),2)::geography,
          ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),3)::geography)/0.3048 AS north_width
      FROM gravesites g ORDER BY grave_id`);
    assert.equal(graves.length, 2);
    assert.equal(graves[0].id, grave.id);
    assert.equal(graves[0].name, "Clifford Chester Brant");
    assert.equal(graves[1].name, "Jacoueline Lois Brant");
    assert.equal(graves[1].grave_id, "0499A");
    assert.equal(graves[1].gravesite_id, "TLC-GPS-0499-01");
    assert.ok(graves[1].latitude > graves[0].latitude);
    for (const g of graves) {
      assert.equal(Number(g.width_feet), 4);
      assert.equal(Number(g.length_feet), 10);
      assert.ok(Math.abs(g.east_length - 10) < 0.001);
      assert.ok(Math.abs(g.north_width - 4) < 0.001);
    }
    const { rows: [geometry] } = await client.query(`
      SELECT ST_Area(ST_Intersection(a.geometry,b.geometry)::geography) AS overlap,
        ST_DWithin(ST_Boundary(a.geometry)::geography,h.geometry::geography,0.001)
        AND ST_DWithin(ST_Boundary(b.geometry)::geography,h.geometry::geography,0.001) AS marker_between,
        ST_IsValid(a.geometry) AND ST_IsValid(b.geometry) AS valid
      FROM gravesites a CROSS JOIN gravesites b CROSS JOIN headstones h
      WHERE a.grave_id='0499' AND b.grave_id='0499A'`);
    assert.equal(geometry.valid, true);
    assert.equal(geometry.marker_between, true);
    assert.ok(geometry.overlap < 0.001);
    const { rows: burials } = await client.query("SELECT first_name,gravesite_uuid,gravesite_id FROM burials ORDER BY first_name");
    assert.deepEqual(burials, [
      { first_name: "Clifford Chester", gravesite_uuid: graves[0].id, gravesite_id: "TLC-GPS-0499" },
      { first_name: "Jacoueline Lois", gravesite_uuid: graves[1].id, gravesite_id: "TLC-GPS-0499-01" },
    ]);
    const { rows: links } = await client.query("SELECT gravesite_uuid,relationship_type FROM headstone_gravesites ORDER BY relationship_type");
    assert.deepEqual(links, [
      { gravesite_uuid: graves[0].id, relationship_type: "primary" },
      { gravesite_uuid: graves[1].id, relationship_type: "spans" },
    ]);
  });
});

test("Brant split rejects missing burial, changed ownership, or occupied new identifier before any update", async () => {
  for (const setup of [
    "DELETE FROM headstone_burials WHERE burial_uuid IN (SELECT id FROM burials WHERE first_name='Jacoueline Lois')",
    "UPDATE burials SET gravesite_uuid=gen_random_uuid() WHERE first_name='Jacoueline Lois'",
    "UPDATE headstones SET geometry=NULL",
    "INSERT INTO gravesites SELECT (jsonb_populate_record(NULL::gravesites,to_jsonb(g) || jsonb_build_object('id',gen_random_uuid(),'grave_id','0499A','gravesite_id','TLC-GPS-0499-01'))).* FROM gravesites g",
  ]) {
    await withFixture(async (client) => {
      await client.query(setup);
      const before = (await client.query("SELECT * FROM gravesites ORDER BY grave_id")).rows;
      await client.query("SAVEPOINT correction");
      await assert.rejects(client.query(migration), /Migration prerequisite failed/u);
      await client.query("ROLLBACK TO SAVEPOINT correction");
      assert.deepEqual((await client.query("SELECT * FROM gravesites ORDER BY grave_id")).rows, before);
    });
  }
});

test("Brant split is a no-op without the original gravesite", async () => {
  await withFixture(async (client) => {
    await client.query("DELETE FROM gravesites");
    const before = (await client.query("SELECT * FROM burials ORDER BY id")).rows;
    await client.query(migration);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM gravesites")).rows[0].count, 0);
    assert.deepEqual((await client.query("SELECT * FROM burials ORDER BY id")).rows, before);
  });
});

test("Brant split rejects overlapping neighboring graves without changing records", async () => {
  await withFixture(async (client) => {
    await client.query(`INSERT INTO gravesites SELECT
      (jsonb_populate_record(NULL::gravesites,to_jsonb(g) || jsonb_build_object(
        'id',gen_random_uuid(),'grave_id','0490','gravesite_id','TLC-GPS-0490',
        'geometry', ST_AsEWKT(ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint(-80.08051,40.60157),4326),0.00002)))))).* FROM gravesites g`);
    const before = (await client.query("SELECT * FROM gravesites ORDER BY grave_id")).rows;
    await client.query("SAVEPOINT correction");
    await assert.rejects(client.query(migration), /avoid other active graves/u);
    await client.query("ROLLBACK TO SAVEPOINT correction");
    assert.deepEqual((await client.query("SELECT * FROM gravesites ORDER BY grave_id")).rows, before);
  });
});

test("Brant split preserves Clifford's military foot marker and its exclusive burial/grave links",async()=>{
  await withFixture(async(client,{grave})=>{
    const {rows:[foot]}=await client.query(`INSERT INTO headstones(headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
      VALUES('TLC-HS-0505',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),ST_SetSRID(ST_MakePoint(-80.08049551453139,40.60155927179527),4326)) RETURNING *`,[grave.id]);
    await client.query(`INSERT INTO headstone_burials(headstone_uuid,burial_uuid)
      SELECT $1,id FROM burials WHERE full_name='Clifford Chester Brant'`,[foot.id]);
    await client.query("INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type) VALUES($1,$2,'footstone')",[foot.id,grave.id]);
    const beforeLinks=(await client.query("SELECT * FROM headstone_burials WHERE headstone_uuid=$1",[foot.id])).rows;
    const beforeGraves=(await client.query("SELECT * FROM headstone_gravesites WHERE headstone_uuid=$1",[foot.id])).rows;
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT * FROM headstones WHERE id=$1",[foot.id])).rows,[foot]);
    assert.deepEqual((await client.query("SELECT * FROM headstone_burials WHERE headstone_uuid=$1",[foot.id])).rows,beforeLinks);
    assert.deepEqual((await client.query("SELECT * FROM headstone_gravesites WHERE headstone_uuid=$1",[foot.id])).rows,beforeGraves);
  });
});
