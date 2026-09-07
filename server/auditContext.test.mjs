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

test("withAuditContext preserves the mutation error and discards a client when rollback fails", async () => {
  const original = new Error("mutation failed");
  const rollbackFailure = new Error("connection lost");
  let releasedWith;
  const pool = { connect: async () => ({
    query: async (sql) => { if (sql === "ROLLBACK") throw rollbackFailure; return { rows: [] }; },
    release: (error) => { releasedWith = error; },
  }) };
  await assert.rejects(withAuditContext(pool, {}, () => { throw original; }), (error) => error === original);
  assert.equal(releasedWith, rollbackFailure);
});

test("withAuditContext supports a deliberate rollback result without committing", async () => {
  const queries = [];
  const pool = { connect: async () => ({ query: async (sql) => { queries.push(sql); }, release() {} }) };
  const result = await withAuditContext(pool, {}, (_client, rollback) => rollback({ forbidden: true }));
  assert.deepEqual(result, { forbidden: true });
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(!queries.includes("COMMIT"));
});

test("withAuditContext does not report a successful no-op if its rollback failed", async () => {
  const failure = new Error("rollback failed");
  const pool = { connect: async () => ({ query: async (sql) => { if (sql === "ROLLBACK") throw failure; }, release() {} }) };
  await assert.rejects(withAuditContext(pool, {}, (_client, rollback) => rollback(undefined)), (error) => error === failure);
});
