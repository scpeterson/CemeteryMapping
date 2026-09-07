import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { updateGraveSpaceMutation } from "../server/cemeteryGraveMutations.mjs";
import { ConflictError } from "../server/requestValidation.mjs";

test("two real database writers cannot overwrite a grave from the same loaded version", async () => {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test", "Run this integration test only with APP_ENV=test");
  const schema = `concurrency_${randomUUID().replaceAll("-", "")}`;
  const setup = new pg.Pool(config.database);
  let writers;
  try {
    await setup.query(`CREATE SCHEMA ${schema}`);
    for (const table of ["gravesites", "gravesite_status_types", "burials", "burial_record_status_types", "owners", "current_ownership_right_owners", "audit_events"]) {
      await setup.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING DEFAULTS)`);
    }
    await setup.query(`INSERT INTO ${schema}.gravesite_status_types SELECT * FROM public.gravesite_status_types`);
    await setup.query(`INSERT INTO ${schema}.gravesites SELECT * FROM public.gravesites WHERE deleted_at IS NULL LIMIT 1`);
    const { rows: [grave] } = await setup.query(`SELECT id, cemetery_id, gravesite_id, xmin::text AS version FROM ${schema}.gravesites`);
    assert.ok(grave, "Test database must contain a seeded grave");
    writers = new pg.Pool({ ...config.database, max: 2, options: `-c search_path=${schema},public` });
    const save = (name) => updateGraveSpaceMutation(writers, grave.cemetery_id, grave.gravesite_id,
      { name, status: "available", cost: null, expectedVersion: grave.version }, {},
      async (client) => (await client.query("SELECT name, xmin::text AS version FROM gravesites WHERE id=$1", [grave.id])).rows[0]);
    const outcomes = await Promise.allSettled([save("Editor A"), save("Editor B")]);
    const successes = outcomes.filter((result) => result.status === "fulfilled");
    const failures = outcomes.filter((result) => result.status === "rejected");
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason instanceof ConflictError);
    const { rows: [saved] } = await setup.query(`SELECT name FROM ${schema}.gravesites WHERE id=$1`, [grave.id]);
    assert.equal(saved.name, successes[0].value.name);
    const { rows: [audit] } = await setup.query(`SELECT count(*)::int AS count FROM ${schema}.audit_events`);
    assert.equal(audit.count, 1, "Only the successful write creates an audit event");
  } finally {
    await writers?.end();
    await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await setup.end();
  }
});
