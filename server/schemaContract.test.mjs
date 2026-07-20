import assert from "node:assert/strict";
import test from "node:test";
import { assertCurrentSchema, requiredSchemaChangeset } from "./schemaContract.mjs";

test("assertCurrentSchema accepts the current Liquibase schema", async () => {
  const queries = [];
  await assertCurrentSchema({
    async query(sql, values) {
      queries.push({ sql, values });
      return { rows: [{ current: true }] };
    },
  });
  assert.deepEqual(queries[0].values, [requiredSchemaChangeset]);
  assert.match(queries[0].sql, /databasechangelog/u);
});

test("assertCurrentSchema rejects an outdated schema with migration guidance", async () => {
  await assert.rejects(
    assertCurrentSchema({ query: async () => ({ rows: [{ current: false }] }) }),
    /npm run db:migrate/u,
  );
});

test("assertCurrentSchema explains an unavailable changelog table", async () => {
  await assert.rejects(
    assertCurrentSchema({ query: async () => { throw new Error("relation does not exist"); } }),
    /Database schema could not be verified.*npm run db:migrate/u,
  );
});
