import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

const sql = await readFile(new URL("../db/changelog/changes/436-link-brandt-markers-common-base.sql", import.meta.url), "utf8");
test("Brandt common base migration preserves separate markers and handles existing links in either direction", async () => {
  const pool = new pg.Pool(integrationAdminDatabase(loadApiConfig()));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE headstones (id uuid DEFAULT gen_random_uuid(),headstone_id text,gravesite_uuid uuid,geometry geometry,deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE gravesites (id uuid DEFAULT gen_random_uuid(),gravesite_id text,cemetery_id uuid,deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE headstone_relationships (LIKE public.headstone_relationships INCLUDING ALL) ON COMMIT DROP;
    `);
    await client.query(sql);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM headstone_relationships")).rows[0].count, 0);
    await client.query(`INSERT INTO gravesites (gravesite_id,cemetery_id) VALUES
      ('TLC-GPS-0451','00000000-0000-4000-8000-000000000001'),
      ('TLC-GPS-0452','00000000-0000-4000-8000-000000000001');
      INSERT INTO headstones (headstone_id,gravesite_uuid,geometry)
      SELECT replace(gravesite_id,'GPS','HS'),id,ST_SetSRID(ST_MakePoint(-80,40),4326) FROM gravesites`);
    const before = (await client.query("SELECT * FROM headstones ORDER BY headstone_id")).rows;
    await client.query(sql);
    const relation = (await client.query("SELECT * FROM headstone_relationships")).rows[0];
    assert.equal(relation.relationship_type, "common_base");
    assert.equal(relation.from_headstone_uuid, before[0].id);
    assert.equal(relation.to_headstone_uuid, before[1].id);
    assert.equal(relation.status, "active");
    await client.query(sql);
    assert.deepEqual((await client.query("SELECT * FROM headstone_relationships")).rows, [relation]);
    await client.query("UPDATE headstone_relationships SET from_headstone_uuid=$1,to_headstone_uuid=$2", [before[1].id,before[0].id]);
    const reversed = (await client.query("SELECT * FROM headstone_relationships")).rows;
    await client.query(sql);
    assert.deepEqual((await client.query("SELECT * FROM headstone_relationships")).rows, reversed);
    assert.deepEqual((await client.query("SELECT * FROM headstones ORDER BY headstone_id")).rows, before);

    for (const change of [
      "UPDATE gravesites SET cemetery_id=gen_random_uuid() WHERE gravesite_id='TLC-GPS-0452'",
      "UPDATE headstones SET deleted_at=now() WHERE headstone_id='TLC-HS-0452'",
    ]) {
      await client.query("SAVEPOINT invalid_fixture");
      await client.query(change);
      await assert.rejects(client.query(sql), /Migration prerequisite failed/u);
      await client.query("ROLLBACK TO SAVEPOINT invalid_fixture");
    }
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
