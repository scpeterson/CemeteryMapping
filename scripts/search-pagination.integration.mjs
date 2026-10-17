import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { searchCemetery } from "../server/cemeterySearch.mjs";

test("real SQL pages complete grave groups within cemetery scope", async () => {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  try {
    const { rows } = await pool.query(`SELECT c.id::text, c.name FROM cemeteries c JOIN gravesites g ON g.cemetery_id = c.id AND g.deleted_at IS NULL WHERE c.deleted_at IS NULL GROUP BY c.id HAVING count(*) >= 4 ORDER BY c.id LIMIT 1`);
    assert.equal(rows.length, 1, "Seed a TEST cemetery with at least four graves");
    const options = { query: rows[0].name, cemeteryId: rows[0].id, includeOwnership: false, limit: 2 };
    const first = await searchCemetery(pool, options);
    const second = await searchCemetery(pool, { ...options, offset: 2 });
    assert.equal(first.length, 3, "includes one complete lookahead grave");
    assert.deepEqual(first[2], second[0]);
    assert.ok(!first.slice(0, 2).some((match) => match.grave.id === second[0].grave.id));
    assert.ok([...first, ...second].every((match) => match.grave.cemeteryId === rows[0].id));
    assert.ok(first.every((match) => match.reasons.includes(`Cemetery: ${rows[0].name}`)));
  } finally { await pool.end(); }
});
