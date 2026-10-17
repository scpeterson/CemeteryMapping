import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { getGraveSpace, getHeadstone } from "../server/cemeteryRepository.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;

test("bounded pool detail reads preserve sequential responses and permission redaction", async () => {
  const config = loadApiConfig(); assert.equal(config.appEnv, "test");
  const admin = new pg.Pool(integrationAdminDatabase(config));
  const schema = `detail_test_${randomUUID().replaceAll("-", "")}`;
  let pool;
  try {
    // Isolate the burial table so older local TEST snapshots can exercise the latest
    // birth-place projection without migrating or altering their public tables.
    await admin.query(`CREATE SCHEMA ${identifier(schema)}`);
    await admin.query(`CREATE TABLE ${identifier(schema)}.burials (LIKE public.burials INCLUDING ALL)`);
    await admin.query(`INSERT INTO ${identifier(schema)}.burials SELECT * FROM public.burials`);
    await admin.query(`ALTER TABLE ${identifier(schema)}.burials ADD COLUMN IF NOT EXISTS birth_place_uuid uuid`);
    await admin.query(`GRANT USAGE ON SCHEMA ${identifier(schema)} TO ${identifier(config.database.user)}`);
    await admin.query(`GRANT SELECT ON ${identifier(schema)}.burials TO ${identifier(config.database.user)}`);
    pool = new pg.Pool({ ...config.database, options: `-c search_path=${schema},public` });
    const { rows } = await pool.query(`SELECT g.cemetery_id::text, g.gravesite_id FROM gravesites g JOIN burials b ON b.gravesite_uuid=g.id WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY g.id LIMIT 1`);
    assert.equal(rows.length, 1, "Seed TEST with a linked burial");
    const parent = rows[0];
    // Omitting query forces the existing single-client path for comparison.
    const sequential = { connect: () => pool.connect() };
    let active = 0; let peak = 0; let statements = 0;
    const concurrent = { async query(sql, values) {
      statements++; active++; peak = Math.max(peak, active);
      try { return await pool.query(sql, values); } finally { active--; }
    } };
    for (const includeOwnership of [false, true]) {
      const expected = await getGraveSpace(sequential, parent.cemetery_id, parent.gravesite_id, { includeOwnership });
      const actual = await getGraveSpace(concurrent, parent.cemetery_id, parent.gravesite_id, { includeOwnership });
      assert.deepEqual(actual, expected);
      if (!includeOwnership) assert.deepEqual(actual.owners, []);
    }
    assert.equal(peak, 3); assert.equal(active, 0);
    const before = statements;
    assert.equal(await getGraveSpace(concurrent, parent.cemetery_id, "NO-SUCH-GRAVE"), undefined);
    assert.equal(statements - before, 1);
    const markers = await pool.query("SELECT id::text FROM headstones WHERE deleted_at IS NULL ORDER BY id LIMIT 1");
    assert.equal(markers.rows.length, 1);
    assert.deepEqual(await getHeadstone(concurrent, markers.rows[0].id), await getHeadstone(sequential, markers.rows[0].id));
    assert.equal(active, 0);
  } finally {
    await pool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${identifier(schema)} CASCADE`);
    await admin.end();
  }
});
