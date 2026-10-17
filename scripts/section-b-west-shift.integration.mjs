import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const createRow = await readFile(new URL("../db/changelog/changes/419-create-trinity-b-lots-24-18-and-1.sql", import.meta.url), "utf8");
const migration = await readFile(new URL("../db/changelog/changes/420-shift-trinity-b-boundary-row-west.sql", import.meta.url), "utf8");
async function fixture(run) {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP;
      CREATE TEMP TABLE cemeteries (id uuid,geometry geometry,deleted_at timestamptz) ON COMMIT DROP;
      INSERT INTO cemeteries VALUES ('00000000-0000-4000-8000-000000000001',
        ST_GeomFromText('POLYGON((-80.080702786 40.600,-80.080702786 40.6020255722,-80.0794283002 40.6016330498,-80.0794283002 40.600,-80.080702786 40.600))',4326),NULL);
      INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
      SELECT id,'1','B','23',16.36,16,ST_Multi(ST_MakeEnvelope(-80.07996821012176,40.601657969137236,-80.07990930690053,40.60170188598915,4326)) FROM cemeteries;
      INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
      SELECT cemetery_id,facility_id,section_id,'2',width_feet,length_feet,
        ST_Translate(geometry,3*(ST_XMax(Box2D(geometry))-ST_XMin(Box2D(geometry))),0) FROM lots;`);
    await client.query(createRow);
    await client.query(`CREATE TEMP TABLE headstones (headstone_id text,geometry geometry,deleted_at timestamptz) ON COMMIT DROP;
      INSERT INTO headstones VALUES
      ('TLC-HS-0138',ST_SetSRID(ST_MakePoint(-80.07985340459823,40.60172958277598),4326),NULL),
      ('TLC-HS-0139',ST_SetSRID(ST_MakePoint(-80.0798539845976,40.60173969277603),4326),NULL);`);
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

test("west shift preserves standard footprints and B-1 edge lengths while enclosing markers", () => fixture(async (client) => {
  await client.query("CREATE TEMP TABLE original_lots AS SELECT * FROM lots; CREATE TEMP TABLE original_markers AS SELECT * FROM headstones");
  await client.query(migration);
  const checks = (await client.query(`SELECT
    bool_and(CASE WHEN l.lot_id IN ('24','18') THEN ST_Equals(l.geometry,ST_Translate(o.geometry,
      ST_XMin(Box2D(l.geometry))-ST_XMin(Box2D(o.geometry)),0)) ELSE true END) footprints,
    bool_and(l.width_feet=o.width_feet AND l.length_feet=o.length_feet) dimensions,
    bool_and(ST_YMin(Box2D(l.geometry))=ST_YMin(Box2D(o.geometry))) latitude,
    max(ST_Distance(ST_SetSRID(ST_MakePoint(ST_XMin(Box2D(l.geometry)),ST_YMin(Box2D(l.geometry))),4326)::geography,
      ST_SetSRID(ST_MakePoint(ST_XMin(Box2D(o.geometry)),ST_YMin(Box2D(o.geometry))),4326)::geography)/0.3048) feet,
    bool_and(ST_XMin(Box2D(l.geometry))<ST_XMin(Box2D(o.geometry))) west
    FROM lots l JOIN original_lots o ON l.id=o.id WHERE l.lot_id IN ('1','18','24')`)).rows[0];
  for (const key of ["footprints","dimensions","latitude","west"]) assert.equal(checks[key],true,key);
  assert.ok(Math.abs(checks.feet-2)<0.0001);
  const shape = (await client.query(`SELECT ST_NPoints(l.geometry) points,ST_IsValid(l.geometry) valid,
    abs((ST_XMax(Box2D(l.geometry))-ST_XMin(Box2D(l.geometry)))-(ST_XMax(Box2D(o.geometry))-ST_XMin(Box2D(o.geometry))))<1e-12 south_length,
    ST_YMax(Box2D(l.geometry))-ST_YMin(Box2D(l.geometry))=ST_YMax(Box2D(o.geometry))-ST_YMin(Box2D(o.geometry)) west_length,
    ST_Length(ST_Intersection(ST_Boundary(l.geometry),ST_Buffer(ST_Boundary(c.geometry),1e-12)))>1e-5 follows_boundary,
    (SELECT bool_and(ST_Contains(l.geometry,h.geometry)) FROM headstones h) contains_markers
    FROM lots l JOIN original_lots o ON o.id=l.id CROSS JOIN cemeteries c WHERE l.lot_id='1'`)).rows[0];
  assert.equal(shape.points,6);
  for (const key of ["valid","south_length","west_length","follows_boundary","contains_markers"]) assert.equal(shape[key],true,key);
  assert.equal((await client.query("SELECT count(*) FROM lots l JOIN original_lots o ON l.id=o.id WHERE l.lot_id NOT IN ('1','18','24') AND to_jsonb(l)=to_jsonb(o)")).rows[0].count,"2");
  assert.deepEqual((await client.query("SELECT * FROM headstones ORDER BY headstone_id")).rows,(await client.query("SELECT * FROM original_markers ORDER BY headstone_id")).rows);
}));

for (const [name,sql,pattern] of [
  ["missing marker", "DELETE FROM headstones WHERE headstone_id='TLC-HS-0139'", /both TLC-HS/],
  ["marker outside B-1", "UPDATE headstones SET geometry=ST_SetSRID(ST_MakePoint(-80.08,40.60),4326) WHERE headstone_id='TLC-HS-0139'", /both TLC-HS/],
  ["overlap with another lot", "INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,facility_id,section_id,'99',ST_Translate(geometry,-0.00002,0) FROM lots WHERE lot_id='24'", /without overlapping/],
]) {
  test(`west shift refuses ${name}`, () => fixture(async (client) => {
    await client.query(sql);
    await assert.rejects(client.query(migration),pattern);
  }));
}

test("west shift skips absent Trinity B", () => fixture(async (client) => {
  await client.query("DELETE FROM lots");
  await client.query(migration);
  assert.equal((await client.query("SELECT count(*) FROM lots")).rows[0].count,"0");
}));
