import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { normalizedSearchSql, veteranSql } from "../server/searchNormalizationSql.mjs";
import { normalizeSearchText, isVeteran } from "../shared/recordNormalization.mjs";
import { searchCemetery } from "../server/cemeterySearch.mjs";
import { selectGravesForCemeteries } from "../server/cemeteryMapQueries.mjs";

test("PostgreSQL normalization agrees with JavaScript for accents and veteran values", async () => {
  const config = loadApiConfig(); assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database);
  try {
    for (const value of [" García ", "GARCÍA", "Garci\u0301a", "José", "O'Neill", " VETERAN ", " Yes ", "no", "0", null]) {
      const { rows } = await pool.query(`SELECT btrim(${normalizedSearchSql("$1::text")}) AS normalized, ${veteranSql("$1::text")} AS veteran`, [value]);
      assert.equal(rows[0].normalized, normalizeSearchText(value));
      assert.equal(rows[0].veteran, isVeteran(value));
    }
  } finally { await pool.end(); }
});

test("accented burial names and veteran text match actual search and map flags", async () => {
  const config = loadApiConfig(); assert.equal(config.appEnv, "test");
  const pool = new pg.Pool(config.database); const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT b.id, g.id AS grave_uuid, g.gravesite_id, g.cemetery_id::text FROM burials b JOIN gravesites g ON g.id = b.gravesite_uuid JOIN cemeteries c ON c.id = g.cemetery_id WHERE b.deleted_at IS NULL AND g.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY b.id LIMIT 1`);
    assert.equal(rows.length, 1, "Seed TEST with a linked burial");
    const row = rows[0];
    await client.query("UPDATE burials SET display_name = 'UniqueJoséGarcía', full_name = 'UniqueJoséGarcía', veteran = ' Yes ' WHERE id = $1", [row.id]);
    const matches = await searchCemetery(client, { query: "UniqueJoseGarcia", includeOwnership: false });
    assert.ok(matches.some((match) => match.grave.id === row.gravesite_id && match.grave.cemeteryId === row.cemetery_id));
    let veteranFound = false;
    for (let offset = 0; offset <= 100000; offset += 50) {
      const veterans = await searchCemetery(client, { query: "veteran", includeOwnership: false, cemeteryId: row.cemetery_id, limit: 50, offset });
      veteranFound = veterans.some((match) => match.grave.id === row.gravesite_id && match.grave.cemeteryId === row.cemetery_id);
      if (veteranFound || veterans.length <= 50) break;
    }
    assert.ok(veteranFound, "whitespace-padded veteran is searchable across pages");
    const map = await selectGravesForCemeteries(client, [row.cemetery_id]);
    assert.equal(map.find((grave) => grave.gravesite_id === row.gravesite_id).has_veteran, true);
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});
