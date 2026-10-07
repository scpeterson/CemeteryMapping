import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

const migration = await readFile(new URL("../db/changelog/changes/435-split-d-0450-miller-gravesites.sql", import.meta.url), "utf8");

async function fixture(client) {
  // Real column types, defaults and uniqueness, isolated from maintained records.
  for (const table of ["gravesites", "headstones", "burials", "headstone_burials", "headstone_gravesites"]) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
  }
  const { rows: [grave] } = await client.query(`
    INSERT INTO gravesites (cemetery_id,section_id,grave_id,gravesite_id,name,status_type_id,geometry)
    VALUES (gen_random_uuid(),'D','0450','TLC-GPS-0450','Peter Miller',gen_random_uuid(),
      ST_Multi(ST_MakeEnvelope(-80.08014,40.60163,-80.08010,40.60165,4326))) RETURNING id`);
  const { rows: [marker] } = await client.query(`
    INSERT INTO headstones (headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
    VALUES ('TLC-HS-0450',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
      ST_SetSRID(ST_MakePoint(-80.08013587456966,40.60163854178448),4326)) RETURNING *`, [grave.id]);
  for (const firstName of ["Peter", "Christina"]) {
    const { rows: [burial] } = await client.query(`
      INSERT INTO burials (gravesite_uuid,gravesite_id,first_name,last_name,interment_type_id,burial_record_status_type_id)
      VALUES ($1,'TLC-GPS-0450',$2,'Miller',gen_random_uuid(),gen_random_uuid()) RETURNING id`, [grave.id, firstName]);
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

test("Miller split keeps the marker fixed between two measured 4-by-10-foot graves and preserves burial links", async () => {
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
    assert.equal(graves[0].name, "Peter Miller");
    assert.equal(graves[1].name, "Christina Miller");
    assert.equal(graves[1].grave_id, "0450A");
    assert.equal(graves[1].gravesite_id, "TLC-GPS-0450-01");
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
      WHERE a.grave_id='0450' AND b.grave_id='0450A'`);
    assert.equal(geometry.valid, true);
    assert.equal(geometry.marker_between, true);
    assert.ok(geometry.overlap < 0.001);
    const { rows: burials } = await client.query("SELECT first_name,gravesite_uuid,gravesite_id FROM burials ORDER BY first_name");
    assert.deepEqual(burials, [
      { first_name: "Christina", gravesite_uuid: graves[1].id, gravesite_id: "TLC-GPS-0450-01" },
      { first_name: "Peter", gravesite_uuid: graves[0].id, gravesite_id: "TLC-GPS-0450" },
    ]);
    const { rows: links } = await client.query("SELECT gravesite_uuid,relationship_type FROM headstone_gravesites ORDER BY relationship_type");
    assert.deepEqual(links, [
      { gravesite_uuid: graves[0].id, relationship_type: "primary" },
      { gravesite_uuid: graves[1].id, relationship_type: "spans" },
    ]);
  });
});

test("Miller split rejects missing burial, changed ownership, or occupied new identifier before any update", async () => {
  for (const setup of [
    "DELETE FROM headstone_burials WHERE burial_uuid IN (SELECT id FROM burials WHERE first_name='Christina')",
    "UPDATE burials SET gravesite_uuid=gen_random_uuid() WHERE first_name='Christina'",
    "UPDATE headstones SET geometry=NULL",
    "INSERT INTO gravesites SELECT (jsonb_populate_record(NULL::gravesites,to_jsonb(g) || jsonb_build_object('id',gen_random_uuid(),'grave_id','0450A','gravesite_id','TLC-GPS-0450-01'))).* FROM gravesites g",
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

test("Miller split is a no-op without the original gravesite", async () => {
  await withFixture(async (client) => {
    await client.query("DELETE FROM gravesites");
    const before = (await client.query("SELECT * FROM burials ORDER BY id")).rows;
    await client.query(migration);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM gravesites")).rows[0].count, 0);
    assert.deepEqual((await client.query("SELECT * FROM burials ORDER BY id")).rows, before);
  });
});
