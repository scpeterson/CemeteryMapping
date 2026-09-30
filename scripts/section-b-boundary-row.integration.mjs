import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const migration = await readFile(new URL("../db/changelog/changes/419-create-trinity-b-lots-24-18-and-1.sql", import.meta.url), "utf8");
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
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

test("boundary row preserves sources and follows the requested gap, edges, and cemetery outline", () => fixture(async (client) => {
  const before = (await client.query("SELECT to_jsonb(lots) row FROM lots ORDER BY lot_id")).rows;
  await client.query(migration);
  assert.deepEqual((await client.query("SELECT to_jsonb(lots) row FROM lots WHERE lot_id IN ('23','2') ORDER BY lot_id")).rows, before);
  const checks = (await client.query(`SELECT
    ST_Distance(ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(a.geometry)),ST_YMax(Box2D(a.geometry))),4326)::geography,
      ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(b.geometry)),ST_YMin(Box2D(b.geometry))),4326)::geography) gap,
    ST_XMin(Box2D(a.geometry))=ST_XMin(Box2D(b.geometry)) aligned_west,
    ST_Equals(ST_Translate(b.geometry,ST_XMin(Box2D(a.geometry))-ST_XMin(Box2D(b.geometry)),
      ST_YMin(Box2D(a.geometry))-ST_YMin(Box2D(b.geometry))),a.geometry) same_shape,
    ST_Equals(ST_Translate(b.geometry,ST_XMin(Box2D(d.geometry))-ST_XMin(Box2D(b.geometry)),0),d.geometry) same_second_shape,
    ST_NPoints(e.geometry) points,ST_IsValid(e.geometry) valid,
    ST_Area(ST_Difference(e.geometry,c.geometry))<1e-16 inside,
    ST_XMax(Box2D(e.geometry))=ST_XMax(Box2D(f.geometry)) aligned_east,
    ST_Length(ST_Intersection(ST_Boundary(e.geometry),ST_Boundary(d.geometry))) shared_west,
    ST_YMax(Box2D(d.geometry))-ST_YMin(Box2D(d.geometry)) height,
    ST_Length(ST_Intersection(ST_Boundary(e.geometry),ST_Boundary(c.geometry))) boundary_length,
    (SELECT count(*) FROM lots x JOIN lots y ON x.lot_id<y.lot_id
      WHERE ST_Area(ST_Intersection(x.geometry,y.geometry))>1e-16) AS overlap_count
    FROM lots a,lots b,lots d,lots e,lots f,cemeteries c
    WHERE a.lot_id='23' AND b.lot_id='24' AND d.lot_id='18' AND e.lot_id='1' AND f.lot_id='2'`)).rows[0];
  assert.ok(Math.abs(checks.gap-1.8288)<0.00001);
  for (const key of ["aligned_west","same_shape","same_second_shape","valid","inside","aligned_east"]) assert.equal(checks[key],true,key);
  assert.equal(checks.points,6);
  assert.ok(Math.abs(checks.shared_west-checks.height)<1e-12);
  assert.ok(checks.boundary_length>0);
  assert.equal(checks.overlap_count,"0");
}));

for (const [name,sql,pattern] of [
  ["reused number", "INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,facility_id,section_id,'24',geometry FROM lots WHERE lot_id='2'", /identifiers must be unused/],
  ["boundary missing the requested clipping", "UPDATE cemeteries SET geometry=ST_MakeEnvelope(-81,40,-79,42,4326)", /five-sided/],
  ["overlapping existing lot", "INSERT INTO lots (cemetery_id,facility_id,section_id,lot_id,geometry) SELECT cemetery_id,facility_id,section_id,'99',ST_Translate(geometry,0,0.000055) FROM lots WHERE lot_id='23'", /must not overlap/],
]) {
  test(`boundary row refuses ${name}`, () => fixture(async (client) => {
    await client.query(sql);
    await assert.rejects(client.query(migration),pattern);
  }));
}

test("absent Trinity B is skipped", () => fixture(async (client) => {
  await client.query("DELETE FROM lots");
  await client.query(migration);
  assert.equal((await client.query("SELECT count(*) FROM lots")).rows[0].count,"0");
}));
