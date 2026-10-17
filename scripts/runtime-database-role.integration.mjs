import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

test("automated TEST uses restricted API credentials and can write audited records", async () => {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  assert.equal(config.database.user, "cemetery_api", "Run APP_ENV=test npm run db:configure-api first");
  const pool = new pg.Pool(config.database);
  try {
    const { rows: [role] } = await pool.query(`SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
      has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
      has_table_privilege(current_user, 'databasechangelog', 'UPDATE') AS migration_write
      FROM pg_roles WHERE rolname=current_user`);
    for (const [privilege, allowed] of Object.entries(role)) assert.equal(allowed, false, privilege);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const changed = await client.query("UPDATE cemeteries SET name=name || ' [rolled-back security test]' WHERE id=(SELECT id FROM cemeteries LIMIT 1)");
      assert.equal(changed.rowCount, 1);
      const { rows: [audit] } = await client.query("SELECT count(*)::int AS count FROM audit_events WHERE transaction_id=txid_current() AND actor_database_user=current_user");
      assert.ok(audit.count >= 1);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  } finally {
    await pool.end();
  }
});
