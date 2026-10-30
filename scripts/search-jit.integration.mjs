import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { searchCemetery, selectSearchMatches } from "../server/cemeterySearch.mjs";
import { withSearchTransaction } from "../server/searchTransaction.mjs";

test("search restores JIT on a reused backend after success, errors and queued unrelated queries", async () => {
  const config = loadApiConfig();
  assert.ok(["dev", "test"].includes(config.appEnv), "Only local DEV/TEST");
  const pool = new pg.Pool({ ...config.database, max: 1, options: "-c default_transaction_read_only=on -c jit=on" });
  const state = async () => (await pool.query("SELECT current_setting('jit') AS jit,pg_backend_pid() AS pid")).rows[0];
  try {
    const before = await state();
    const inside = await withSearchTransaction(pool, async client => {
      const row = (await client.query("SELECT current_setting('jit') AS jit,pg_backend_pid() AS pid")).rows[0];
      assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on");
      return row;
    });
    assert.deepEqual(inside, { jit: "off", pid: before.pid });
    assert.deepEqual(await state(), before);
    await assert.rejects(withSearchTransaction(pool, client => client.query("SELECT 1/0")), /division by zero/u);
    assert.deepEqual(await state(), before);
    const [searchState, otherState] = await Promise.all([
      withSearchTransaction(pool, async client => (await client.query("SELECT current_setting('jit') AS jit")).rows[0]),
      state(),
    ]);
    assert.equal(searchState.jit, "off");
    assert.deepEqual(otherState, before);
  } finally { await pool.end(); }
});

test("scoped JIT search preserves complete results, reasons, ownership visibility, filters and pagination", async () => {
  const config = loadApiConfig();
  assert.ok(["dev", "test"].includes(config.appEnv), "Only local DEV/TEST");
  const pool = new pg.Pool({ ...config.database, max: 1, options: "-c default_transaction_read_only=on -c jit=on" });
  try {
    const grave = (await pool.query("SELECT cemetery_id,gravesite_id FROM gravesites WHERE deleted_at IS NULL ORDER BY id LIMIT 1")).rows[0];
    assert.ok(grave, "Requires at least one active grave");
    for (const options of [
      { query: grave.gravesite_id },
      { query: "a", cemeteryId: grave.cemetery_id, limit: 2, offset: 1 },
      { query: "a", includeOwnership: false },
      { query: "a", includeOwnership: true, ownershipCemeteryIds: [] },
      { query: "a", includeOwnership: true, ownershipCemeteryIds: [grave.cemetery_id] },
      { query: "", statuses: ["occupied", "sold"], limit: 2 },
      { query: "searchnomatch938172" },
      { query: "Garcia'; DROP TABLE gravesites; --" },
    ]) {
      const original = await selectSearchMatches(pool, options);
      assert.deepEqual(await searchCemetery(pool, options), original);
      assert.equal((await pool.query("SHOW jit")).rows[0].jit, "on");
    }
  } finally { await pool.end(); }
});
