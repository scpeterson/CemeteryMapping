import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const migration = await readFile(new URL("../db/changelog/changes/422-shift-trinity-b-five-lots-north.sql", import.meta.url), "utf8");

async function fixture(run) {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP");
    await client.query(`INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,width_feet,length_feet,geometry)
      SELECT '00000000-0000-4000-8000-000000000001','1','B',lot_id,16.36,16,
        ST_Multi(ST_Translate(ST_MakeEnvelope(-80.07979150045807,40.6015536666146,-80.07973259723684,40.601597583466514,4326),
          col*0.00005890322123,row_number*0.000043916851914))
      FROM (VALUES ('4',0,0),('15',-1,0),('21',-2,0),('5',0,-1),('14',-1,-1),('99',0,-3)) grid(lot_id,col,row_number);`);
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

test("five-lot shift preserves footprints, shared edges, and anchor while moving north only", () => fixture(async (client) => {
  await client.query("CREATE TEMP TABLE before_lots AS SELECT * FROM lots");
  await client.query(migration);
  const result = (await client.query(`WITH shifts AS (
    SELECT l.*,o.geometry original,
      ST_XMin(Box2D(l.geometry))-ST_XMin(Box2D(o.geometry)) dx,
      ST_YMin(Box2D(l.geometry))-ST_YMin(Box2D(o.geometry)) dy
    FROM lots l JOIN before_lots o ON l.id=o.id WHERE l.lot_id<>'99')
    SELECT count(*) count,bool_and(dx=0 AND dy>0) direction,
      max(dx)-min(dx) dx_range,max(dy)-min(dy) dy_range,
      bool_and(ST_Equals(geometry,ST_Translate(original,dx,dy))) same_shape,
      bool_and(width_feet=16.36 AND length_feet=16.00) dimensions,
      avg(ST_Distance(ST_Centroid(original)::geography,
        ST_Translate(ST_Centroid(original),dx,0)::geography)/0.3048) west_feet,
      avg(ST_Distance(ST_Centroid(original)::geography,
        ST_Translate(ST_Centroid(original),0,dy)::geography)/0.3048) north_feet
    FROM shifts`)).rows[0];
  assert.equal(result.count,"5");
  for (const key of ["direction","same_shape","dimensions"]) assert.equal(result[key],true,key);
  assert.ok(result.dx_range<1e-12 && result.dy_range<1e-12);
  assert.ok(Math.abs(result.west_feet)<0.00001);
  assert.ok(Math.abs(result.north_feet-1)<0.00001);
  assert.equal((await client.query("SELECT to_jsonb(l)=to_jsonb(o) unchanged FROM lots l JOIN before_lots o ON l.id=o.id WHERE l.lot_id='99'")).rows[0].unchanged,true);
  assert.equal((await client.query(`SELECT count(*) FROM lots a JOIN lots b ON a.lot_id<b.lot_id
    WHERE a.lot_id<>'99' AND b.lot_id<>'99'
      AND ST_Length(ST_Intersection(ST_Boundary(a.geometry),ST_Boundary(b.geometry)))>0`)).rows[0].count,"5");
}));

for (const [name,sql,pattern] of [
  ["missing group lot", "DELETE FROM lots WHERE lot_id='21'", /all five active/],
  ["overlap with another lot", "INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,facility_id,section_id,'100',ST_Translate(geometry,0,0.000003) FROM lots WHERE lot_id='21'", /must not overlap/],
]) {
  test(`five-lot shift refuses ${name}`, () => fixture(async (client) => {
    await client.query(sql);
    await assert.rejects(client.query(migration),pattern);
  }));
}

test("five-lot shift skips absent Trinity B", () => fixture(async (client) => {
  await client.query("DELETE FROM lots");
  await client.query(migration);
  assert.equal((await client.query("SELECT count(*) FROM lots")).rows[0].count,"0");
}));
