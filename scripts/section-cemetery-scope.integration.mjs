import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
import { selectSectionsForCemeteries } from "../server/cemeteryMapQueries.mjs";

test("section projection carries cemetery identity and excludes other, deleted and unmapped sections", async () => {
  const config = loadApiConfig(); assert.equal(config.appEnv, "test");
  const client = new pg.Client(integrationAdminDatabase(config)); await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE sections(section_id uuid, cemetery_id uuid, name text, alternate_names text[], geometry geometry(MultiPolygon,4326), deleted_at timestamptz) ON COMMIT DROP`);
    const cemetery = randomUUID(), other = randomUUID();
    for (const [id, name, deleted] of [[cemetery, "A", false], [other, "A", false], [cemetery, "B", true]]) {
      await client.query(`INSERT INTO sections VALUES($1,$2,$3,ARRAY[]::text[],ST_Multi(ST_MakeEnvelope(0,0,1,1,4326)),CASE WHEN $4 THEN now() END)`, [randomUUID(), id, name, deleted]);
    }
    await client.query("INSERT INTO sections(section_id,cemetery_id,name) VALUES($1,$2,'No geometry')", [randomUUID(), cemetery]);
    const scoped = await selectSectionsForCemeteries(client, [cemetery]);
    assert.equal(scoped.length, 1); assert.equal(scoped[0].cemetery_id, cemetery); assert.equal(scoped[0].section_id, "A");
    assert.equal((await selectSectionsForCemeteries(client, [cemetery, other])).length, 2);
  } finally { await client.query("ROLLBACK"); await client.end(); }
});
