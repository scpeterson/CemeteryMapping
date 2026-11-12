import {createLegacyTableFixture} from "./lib/legacy-table-fixtures.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

const migration = await readFile(new URL("../db/changelog/changes/517-split-e-0543-koenig-gravesites.sql", import.meta.url), "utf8");

async function fixture(client) {
  // Real column types, defaults and uniqueness, isolated from maintained records.
  for (const table of ["gravesites", "headstones", "burials", "headstone_burials", "headstone_gravesites"]) {
    await createLegacyTableFixture(client, table);
  }
  const { rows: [grave] } = await client.query(`
    INSERT INTO gravesites (cemetery_id,section_id,grave_id,gravesite_id,name,status_type_id,width_feet,length_feet,geometry)
    VALUES (gen_random_uuid(),'E','0543','TLC-GPS-0543','Nicholas Köenig',gen_random_uuid(),4,10,
      ST_GeomFromText('MULTIPOLYGON(((-80.08056649478803 40.601756793988486,-80.08055633423932 40.60174904960667,-80.08053593418774 40.60176459854473,-80.0805460947341 40.601772342926516,-80.08056649478803 40.601756793988486)))',4326)) RETURNING id`);
  const { rows: [marker] } = await client.query(`
    INSERT INTO headstones (headstone_id,gravesite_uuid,marker_type_id,material_type_id,condition_type_id,geometry)
    VALUES ('TLC-HS-0543',$1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
      ST_SetSRID(ST_MakePoint(-80.08042099453998,40.60156284179303),4326)) RETURNING *`, [grave.id]);
  for (const firstName of ["Margareta", "Nicholas"]) {
    const { rows: [burial] } = await client.query(`
      INSERT INTO burials (gravesite_uuid,gravesite_id,first_name,last_name,full_name,interment_type_id,burial_record_status_type_id)
      VALUES ($1,'TLC-GPS-0543',$2::text,'Köenig',$2::text || ' Köenig',gen_random_uuid(),gen_random_uuid()) RETURNING id`, [grave.id, firstName]);
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

test("Köenig split keeps the marker fixed and places Nicholas southeast while preserving burial links", async () => {
  await withFixture(async (client, { grave, marker }) => {
    const beforeLinks = (await client.query("SELECT * FROM headstone_burials ORDER BY burial_uuid")).rows;
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT * FROM headstones")).rows, [marker]);
    assert.deepEqual((await client.query("SELECT * FROM headstone_burials ORDER BY burial_uuid")).rows, beforeLinks);
    const { rows: graves } = await client.query("SELECT *,ST_X(ST_Centroid(geometry)) x,ST_Y(ST_Centroid(geometry)) y FROM gravesites ORDER BY grave_id");
    assert.equal(graves.length,2);
    assert.equal(graves[0].id,grave.id);
    assert.equal(graves[0].name,"Margareta Köenig");
    assert.equal(graves[1].name,"Nicholas Köenig");
    assert.ok(graves[1].x>graves[0].x && graves[1].y<graves[0].y);
    assert.equal(graves[1].grave_id,"0543A");
    assert.match(graves[1].geometry_notes,/accepts overlap/u);
    const { rows: burials } = await client.query("SELECT first_name,gravesite_uuid,gravesite_id FROM burials ORDER BY first_name");
    assert.deepEqual(burials, [
      { first_name: "Margareta", gravesite_uuid: graves[0].id, gravesite_id: "TLC-GPS-0543" },
      { first_name: "Nicholas", gravesite_uuid: graves[1].id, gravesite_id: "TLC-GPS-0543-01" },
    ]);
    const { rows: links } = await client.query("SELECT gravesite_uuid,relationship_type FROM headstone_gravesites ORDER BY relationship_type");
    assert.deepEqual(links, [
      { gravesite_uuid: graves[0].id, relationship_type: "primary" },
      { gravesite_uuid: graves[1].id, relationship_type: "spans" },
    ]);
  });
});

test("Köenig split rejects missing burial, changed ownership, or occupied new identifier before any update", async () => {
  for (const setup of [
    "DELETE FROM headstone_burials WHERE burial_uuid IN (SELECT id FROM burials WHERE first_name='Nicholas')",
    "UPDATE burials SET gravesite_uuid=gen_random_uuid() WHERE first_name='Nicholas'",
    "UPDATE headstones SET geometry=NULL",
    "INSERT INTO gravesites SELECT (jsonb_populate_record(NULL::gravesites,to_jsonb(g) || jsonb_build_object('id',gen_random_uuid(),'grave_id','0543A','gravesite_id','TLC-GPS-0543-01'))).* FROM gravesites g",
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

test("Köenig split is a no-op without the original gravesite", async () => {
  await withFixture(async (client) => {
    await client.query("DELETE FROM gravesites");
    const before = (await client.query("SELECT * FROM burials ORDER BY id")).rows;
    await client.query(migration);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM gravesites")).rows[0].count, 0);
    assert.deepEqual((await client.query("SELECT * FROM burials ORDER BY id")).rows, before);
  });
});

test("Köenig split accepts historic mapped overlap and preserves neighbors", async () => {
  await withFixture(async (client) => {
    await client.query(`INSERT INTO gravesites SELECT (jsonb_populate_record(NULL::gravesites,to_jsonb(g)||jsonb_build_object(
      'id',gen_random_uuid(),'grave_id','0573','gravesite_id','TLC-GPS-0573'))).* FROM gravesites g`);
    const before=(await client.query("SELECT * FROM gravesites WHERE grave_id='0573'")).rows;
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT * FROM gravesites WHERE grave_id='0573'")).rows,before);
  });
});

test("Köenig split accepts hosted ASCII spellings without changing burial names", async () => {
  await withFixture(async (client) => {
    await client.query("UPDATE burials SET full_name=replace(full_name,'Köenig','Koenig')");
    await client.query(migration);
    const rows=(await client.query("SELECT full_name,gravesite_id FROM burials ORDER BY full_name")).rows;
    assert.deepEqual(rows,[
      {full_name:"Margareta Koenig",gravesite_id:"TLC-GPS-0543"},
      {full_name:"Nicholas Koenig",gravesite_id:"TLC-GPS-0543-01"},
    ]);
  });
});
