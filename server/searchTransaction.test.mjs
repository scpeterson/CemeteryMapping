import assert from "node:assert/strict";
import test from "node:test";
import { searchCemetery } from "./cemeterySearch.mjs";
import { withSearchTransaction } from "./searchTransaction.mjs";

function fixture(failAt) {
  const calls = [], releases = [];
  const failure = new Error("query failed"), rollbackFailure = new Error("rollback failed");
  const client = { async query(sql, parameters) {
    calls.push({ sql, parameters });
    if (failAt === sql || failAt === "rollback" && sql === "SELECT fixture") throw failure;
    if (failAt === "rollback" && sql === "ROLLBACK") throw rollbackFailure;
    return { rows: [] };
  }, release(error) { releases.push(error); } };
  return { calls, releases, failure, rollbackFailure, pool: { async connect() { return client; }, query() { throw Error("Pool queries cannot carry transaction state"); } } };
}

test("public search plans its parameterized query after transaction-local JIT disable and commits", async () => {
  const f = fixture();
  assert.deepEqual(await searchCemetery(f.pool, { query: "Garcia", includeOwnership: false }), []);
  assert.deepEqual(f.calls.slice(0, 2).map(c => c.sql), ["BEGIN READ ONLY", "SET LOCAL jit = off"]);
  assert.equal(f.calls.length, 4);
  assert.match(f.calls[2].sql, /base_graves AS/u);
  assert.equal(f.calls[2].parameters[0], "garcia");
  assert.equal(f.calls[3].sql, "COMMIT");
  assert.deepEqual(f.releases, [undefined]);
});

for (const command of ["BEGIN READ ONLY", "SET LOCAL jit = off", "SELECT fixture", "COMMIT"]) {
  test(`search rolls back and releases its connection after ${command} failure`, async () => {
    const f = fixture(command);
    await assert.rejects(withSearchTransaction(f.pool, c => c.query("SELECT fixture")), error => error === f.failure);
    assert.equal(f.calls.at(-1).sql, "ROLLBACK");
    assert.deepEqual(f.releases, [undefined]);
  });
}

test("failed rollback discards the connection while preserving the original error", async () => {
  const f = fixture("rollback");
  await assert.rejects(withSearchTransaction(f.pool, c => c.query("SELECT fixture")), error => error === f.failure);
  assert.deepEqual(f.releases, [f.rollbackFailure]);
});

test("connection acquisition failure is propagated without starting a transaction", async () => {
  const error = new Error("pool unavailable");
  await assert.rejects(withSearchTransaction({ connect: async () => { throw error; } }, () => assert.fail()), value => value === error);
});
