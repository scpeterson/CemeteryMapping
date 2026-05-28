import assert from "node:assert/strict";
import test from "node:test";
import { withAuditContext } from "./auditContext.mjs";

test("withAuditContext sets app audit settings inside a transaction", async () => {
  const calls = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          calls.push({ sql, values });
          return { rows: [] };
        },
        release() {
          calls.push({ sql: "release" });
        },
      };
    },
  };

  await withAuditContext(
    pool,
    {
      actorUser: {
        id: "11111111-1111-4111-8111-111111111111",
        subject: "auth0|user-1",
        email: "admin@example.test",
        role: "admin",
      },
      reason: "Correct cemetery metadata",
    },
    async (client) => {
      await client.query("UPDATE cemeteries SET notes = notes");
    },
  );

  assert.equal(calls[0].sql, "BEGIN");
  assert.deepEqual(
    calls
      .filter((call) => String(call.sql).includes("set_config"))
      .map((call) => call.values),
    [
      ["app.audit.user_id", "11111111-1111-4111-8111-111111111111"],
      ["app.audit.external_subject", "auth0|user-1"],
      ["app.audit.email", "admin@example.test"],
      ["app.audit.role", "admin"],
      ["app.audit.reason", "Correct cemetery metadata"],
      ["app.audit.source", "api"],
    ],
  );
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "release");
});

test("withAuditContext rolls back and releases the client when a mutation fails", async () => {
  const calls = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          calls.push({ sql, values });
          return { rows: [] };
        },
        release() {
          calls.push({ sql: "release" });
        },
      };
    },
  };

  await assert.rejects(
    withAuditContext(pool, {}, async () => {
      throw new Error("mutation failed");
    }),
    /mutation failed/,
  );

  assert.deepEqual(
    calls.map((call) => call.sql),
    ["BEGIN", "SELECT set_config($1, $2, true)", "ROLLBACK", "release"],
  );
});
