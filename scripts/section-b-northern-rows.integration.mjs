import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const migration = await readFile(new URL("../db/changelog/changes/418-create-trinity-b-two-northern-lot-rows.sql", import.meta.url), "utf8");
const order = ["3", "16", "20", "22", "2", "17", "19", "23"];

async function fixture(run) {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE lots (LIKE public.lots INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP");
    await client.query(`INSERT INTO lots (cemetery_id, facility_id, section_id, lot_id, name, width_feet, length_feet, geometry)
      VALUES (gen_random_uuid(),'1','B','4','B-4',16.36,16,
        ST_Multi(ST_MakeEnvelope(-80.07979150045807,40.6015536666146,-80.07973259723684,40.601597583466514,4326)))`);
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

test("new B rows preserve the anchor, lot footprint, row order, gap, and shared edges", () => fixture(async (client) => {
  const before = (await client.query("SELECT to_jsonb(lots) AS row FROM lots")).rows[0].row;
  await client.query(migration);
  assert.deepEqual((await client.query("SELECT to_jsonb(lots) AS row FROM lots WHERE lot_id='4'")).rows[0].row, before);
  const rows = (await client.query(`SELECT lot_id,width_feet,length_feet,ST_IsValid(geometry) AS valid,
    ST_XMin(Box2D(geometry)) AS west,ST_YMin(Box2D(geometry)) AS south,
    ST_YMax(Box2D(geometry)) AS north,ST_Area(geometry) AS area
    FROM lots WHERE lot_id<>'4' ORDER BY ST_YMin(Box2D(geometry)), ST_XMin(Box2D(geometry)) DESC`)).rows;
  assert.deepEqual(rows.map((r) => r.lot_id), order);
  for (const row of rows) {
    assert.equal(row.width_feet, "16.36");
    assert.equal(row.length_feet, "16.00");
    assert.equal(row.valid, true);
  }
  const checks = (await client.query(`SELECT
    (SELECT ST_Distance(ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(a.geometry)),ST_YMax(Box2D(a.geometry))),4326)::geography,
      ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(b.geometry)),ST_YMin(Box2D(b.geometry))),4326)::geography)
      FROM lots a,lots b WHERE a.lot_id='4' AND b.lot_id='3') AS gap,
    (SELECT count(*) FROM lots a JOIN lots b ON a.lot_id<b.lot_id
      WHERE ST_Length(ST_Intersection(ST_Boundary(a.geometry),ST_Boundary(b.geometry)))>0) AS shared_edges,
    (SELECT count(*) FROM lots a JOIN lots b ON a.lot_id<b.lot_id
      WHERE ST_Area(ST_Intersection(a.geometry,b.geometry))>1e-16) AS overlaps,
    (SELECT bool_and(abs(ST_Area(b.geometry)-ST_Area(a.geometry))<1e-16)
      FROM lots a,lots b WHERE a.lot_id='4') AS equal_area`)).rows[0];
  assert.ok(Math.abs(checks.gap - 1.8288) < 0.00001);
  assert.equal(checks.shared_edges, "10");
  assert.equal(checks.overlaps, "0");
  assert.equal(checks.equal_area, true);
}));

for (const [name, sql, pattern] of [
  ["existing target", "INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,facility_id,section_id,'3',geometry FROM lots", /identifiers must be unused/],
  ["overlapping existing lot", "UPDATE lots SET lot_id='99'; INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,facility_id,section_id,'4',ST_Translate(geometry,0,-0.00005) FROM lots", /must not overlap/],
]) {
  test(`new B rows refuse ${name}`, () => fixture(async (client) => {
    await client.query(sql);
    await assert.rejects(client.query(migration), pattern);
  }));
}

test("environments without Trinity B are skipped", () => fixture(async (client) => {
  await client.query("DELETE FROM lots");
  await client.query(migration);
  assert.equal((await client.query("SELECT count(*) FROM lots")).rows[0].count, "0");
}));
