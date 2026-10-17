import assert from "node:assert/strict";
import test from "node:test";
import { runBoundedQueries } from "./queryBatch.mjs";
const gate = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const flush = () => new Promise((resolve) => setImmediate(resolve));
test("query batches overlap only up to the limit and preserve result order", async () => {
  const gates = Array.from({ length: 5 }, gate);
  const started = [];
  const batch = runBoundedQueries(gates.map((pending, index) => async () => { started.push(index); await pending.promise; return index; }), 2);
  assert.deepEqual(started, [0, 1]);
  gates[1].resolve(); await flush(); assert.deepEqual(started, [0, 1, 2]);
  gates[2].resolve(); await flush(); assert.deepEqual(started, [0, 1, 2, 3]);
  gates[0].resolve(); await flush(); assert.deepEqual(started, [0, 1, 2, 3, 4]);
  gates[3].resolve(); gates[4].resolve();
  assert.deepEqual(await batch, [0, 1, 2, 3, 4]);
});
test("failures stop queued work and wait for in-flight queries before rejecting", async () => {
  const pending = gate(); const fail = gate(); const error = new Error("database unavailable");
  let queued = false; let settled = false;
  const batch = runBoundedQueries([async () => { await fail.promise; throw error; }, async () => { await pending.promise; }, async () => { queued = true; }], 2);
  const rejection = assert.rejects(batch, (actual) => actual === error).then(() => { settled = true; });
  fail.resolve(); await flush();
  assert.equal(settled, false); assert.equal(queued, false);
  pending.resolve(); await rejection;
  assert.equal(queued, false);
});
test("empty batches and sequential mode work; invalid concurrency fails", async () => {
  assert.deepEqual(await runBoundedQueries([]), []);
  assert.deepEqual(await runBoundedQueries([async () => 1, async () => 2], 1), [1, 2]);
  for (const limit of [0, -1, 1.5]) await assert.rejects(runBoundedQueries([], limit), RangeError);
});
