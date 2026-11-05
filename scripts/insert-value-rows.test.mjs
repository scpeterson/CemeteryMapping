import assert from "node:assert/strict";
import test from "node:test";
import { insertValueRows } from "./lib/insert-value-rows.mjs";

test("bounded imports keep values bound and restart parameter numbering at chunk boundaries", async () => {
  const calls = [];
  await insertValueRows({ query: async (sql, values) => calls.push({ sql, values }) }, "INSERT INTO staging(id,label)",
    [[1,"O'Brien"],[2,"$3; DROP TABLE staging"],[3,"last"]], { maxRows: 2 });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].values, [1,"O'Brien",2,"$3; DROP TABLE staging"]);
  assert.deepEqual(calls[1].values, [3,"last"]);
  assert.ok(calls[1].sql.includes("($1,$2)"));
  assert.ok(!calls[0].sql.includes("DROP TABLE"));
});

test("batch failure stops further imports and preserves the original database error", async () => {
  let calls = 0; const failure = new Error("constraint violation");
  await assert.rejects(insertValueRows({ query: async () => { calls++; throw failure; } }, "INSERT INTO staging(id)", [[1],[2],[3]], { maxRows: 1 }), error => error === failure);
  assert.equal(calls, 1);
});
