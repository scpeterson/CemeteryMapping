import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

const { Pool } = pg;

test("migration prerequisite helper accepts true and rejects false or null", async () => {
  const pool = new Pool(loadApiConfig().database);
  const client = await pool.connect();

  try {
    await client.query("SELECT assert_migration_prerequisite(true, 'test prerequisite')");

    for (const condition of [false, null]) {
      await assert.rejects(
        client.query("SELECT assert_migration_prerequisite($1, 'active test marker must exist')", [condition]),
        /Migration prerequisite failed: active test marker must exist/u,
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
});
