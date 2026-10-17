import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const migration = await readFile(new URL("../db/changelog/changes/417-normalize-mary-mashey-prerequisite.sql", import.meta.url), "utf8");
const grave = "00000000-0000-4000-8000-000000000001";
const marker = "00000000-0000-4000-8000-000000000002";
const amos = "00000000-0000-4000-8000-000000000003";
const mary = "00000000-0000-4000-8000-000000000004";

async function withFixture(run) {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Connection-local tables avoid touching real Trinity or other parallel tests.
    await client.query(`
      CREATE TEMP TABLE databasechangelog (id text, author text, filename text) ON COMMIT DROP;
      CREATE TEMP TABLE gravesites (id uuid, gravesite_id text, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE headstones (id uuid, headstone_id text, gravesite_uuid uuid, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE headstone_burials (headstone_uuid uuid, burial_uuid uuid, deleted_at timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE burials (id uuid, gravesite_uuid uuid, first_name text, last_name text, maiden_name text,
        full_name text, birth_date_text text, death_date_text text, notes text,
        updated_at timestamptz DEFAULT '2000-01-01', deleted_at timestamptz) ON COMMIT DROP;
    `);
    await client.query("INSERT INTO gravesites VALUES ($1,'TLC-GPS-0103',NULL)", [grave]);
    await client.query("INSERT INTO headstones VALUES ($1,'TLC-HS-0103',$2,NULL)", [marker, grave]);
    await client.query(`INSERT INTO burials (id,gravesite_uuid,first_name,last_name,full_name,birth_date_text,death_date_text,notes)
      VALUES ($1,$3,'Amos','Mashey','Amos Mashey','1839','1912','Amos source'),
        ($2,$3,'Mary','Mashey/Gollmar','Mary Mashey/Gollmar','1845','1911','Mary source')`, [amos, mary, grave]);
    await client.query("INSERT INTO headstone_burials VALUES ($1,$2,NULL),($1,$3,NULL)", [marker, amos, mary]);
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}

const snapshot = async (client) => (await client.query("SELECT to_jsonb(b) AS row FROM burials b ORDER BY id")).rows.map(({ row }) => row);

test("Mashey prerequisite normalizes only Mary's imported name and is repeatable", () => withFixture(async (client) => {
  const before = await snapshot(client);
  await client.query(migration);
  const after = await snapshot(client);
  assert.deepEqual(after[0], before[0]);
  assert.deepEqual(after[1], { ...before[1], last_name: "Mashey", maiden_name: "Gollmar", full_name: "Mary Mashey", updated_at: after[1].updated_at });
  assert.notEqual(after[1].updated_at, before[1].updated_at);
  await client.query(migration);
  assert.deepEqual(await snapshot(client), after);
  assert.equal((await client.query("SELECT count(*) FROM headstone_burials")).rows[0].count, "2");
}));

test("already-split environments retain later user edits", () => withFixture(async (client) => {
  await client.query("INSERT INTO databasechangelog VALUES ('415-split-b-0103-mashey-gravesites','cemeterymapping','changes/415-split-b-0103-mashey-gravesites.sql')");
  await client.query("UPDATE burials SET maiden_name='Later reviewed value' WHERE id=$1", [mary]);
  const before = await snapshot(client);
  await client.query(migration);
  assert.deepEqual(await snapshot(client), before);
}));

test("environments without an active Trinity source are unchanged", () => withFixture(async (client) => {
  await client.query("UPDATE gravesites SET deleted_at=now()");
  const before = await snapshot(client);
  await client.query(migration);
  assert.deepEqual(await snapshot(client), before);
}));

for (const [label, sql] of [
  ["conflicting maiden name", "UPDATE burials SET maiden_name='Different' WHERE first_name='Mary'"],
  ["unexpected full name", "UPDATE burials SET full_name='Mary A Mashey' WHERE first_name='Mary'"],
  ["deleted marker link", "UPDATE headstone_burials SET deleted_at=now() WHERE burial_uuid='00000000-0000-4000-8000-000000000004'"],
  ["missing burial", "DELETE FROM burials WHERE first_name='Mary'"],
  ["additional burial", "INSERT INTO burials SELECT * FROM burials WHERE first_name='Mary'"],
]) {
  test(`Mashey prerequisite refuses ${label}`, () => withFixture(async (client) => {
    await client.query(sql);
    const before = await snapshot(client);
    await client.query("SAVEPOINT repair_attempt");
    await assert.rejects(client.query(migration), /Migration prerequisite failed/);
    await client.query("ROLLBACK TO SAVEPOINT repair_attempt");
    assert.deepEqual(await snapshot(client), before);
  }));
}
