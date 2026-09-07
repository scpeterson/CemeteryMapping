import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { headstoneCemeteryIdSql, headstoneCemeteryJoinsSql } from "../server/headstoneCemeterySql.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("marker cemetery resolution respects precedence, deleted records, and caller-independent ownership", async () => {
  const pool = new pg.Pool(loadApiConfig().database);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE cemeteries (id uuid, name text, geometry geometry, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE gravesites (id uuid, cemetery_id uuid, gravesite_id text, section_id text, grave_id text, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE headstones (id uuid, gravesite_uuid uuid, geometry geometry) ON COMMIT DROP;
      CREATE TEMP TABLE headstone_gravesites (headstone_uuid uuid, gravesite_uuid uuid, deleted_at timestamptz) ON COMMIT DROP;
    `);
    await client.query("INSERT INTO cemeteries VALUES ($1, 'A', ST_MakeEnvelope(0,0,10,10,4326), NULL), ($2, 'B', ST_MakeEnvelope(20,20,30,30,4326), NULL)", [uuid(1), uuid(2)]);
    await client.query("INSERT INTO gravesites VALUES ($1,$2,'A',NULL,NULL,NULL), ($3,$4,'B',NULL,NULL,NULL)", [uuid(3),uuid(1),uuid(4),uuid(2)]);
    await client.query("INSERT INTO headstones VALUES ($1,$2,ST_SetSRID(ST_MakePoint(25,25),4326))", [uuid(5),uuid(3)]);
    await client.query("INSERT INTO headstone_gravesites VALUES ($1,$2,NULL)", [uuid(5),uuid(4)]);
    const resolve = async (scope = null) => (await client.query(`SELECT ${headstoneCemeteryIdSql}::text AS cemetery_id FROM headstones ${headstoneCemeteryJoinsSql} WHERE ($1::uuid[] IS NULL OR ${headstoneCemeteryIdSql} = ANY($1::uuid[]))`, [scope])).rows[0]?.cemetery_id ?? undefined;
    assert.equal(await resolve(), uuid(1), "direct grave overrides linked grave and geometry");
    assert.equal(await resolve([uuid(2)]), undefined, "scope does not reassign ownership");
    await client.query("UPDATE gravesites SET deleted_at=now() WHERE id=$1", [uuid(3)]);
    assert.equal(await resolve(), uuid(2), "active link replaces deleted direct grave");
    await client.query("UPDATE headstones SET geometry=NULL");
    assert.equal(await resolve(), uuid(2), "linked-only markers need no geometry");
    await client.query("UPDATE headstone_gravesites SET deleted_at=now()");
    assert.equal(await resolve(), undefined);
    await client.query("UPDATE headstones SET geometry=ST_SetSRID(ST_MakePoint(25,25),4326)");
    assert.equal(await resolve(), uuid(2), "geometry is the final fallback");
    await client.query("UPDATE cemeteries SET deleted_at=now() WHERE id=$1", [uuid(2)]);
    assert.equal(await resolve(), undefined, "deleted cemeteries never grant ownership");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
