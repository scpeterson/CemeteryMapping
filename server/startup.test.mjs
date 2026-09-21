import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";
import { loadApiConfig } from "./config.mjs";
import { startServer } from "./index.mjs";

function fakePool(current = true) {
  return { ends: 0, query: async () => ({ rows: [{ current }] }), async end() { this.ends++; } };
}

test("occupied API port rejects startup without announcing success or retaining connections", async (t) => {
  const occupied = createServer();
  occupied.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { occupied.once("listening", resolve); occupied.once("error", reject); });
  t.after(() => new Promise((resolve) => occupied.close(resolve)));
  const log = t.mock.method(console, "log", () => {});
  const pool = fakePool();
  const signalListeners = process.listenerCount("SIGTERM");
  await assert.rejects(startServer({ ...loadApiConfig(), apiPort: occupied.address().port }, pool), (error) => {
    assert.match(error.message, /port .* is already in use/);
    assert.equal(error.cause.code, "EADDRINUSE");
    return true;
  });
  assert.equal(log.mock.callCount(), 0);
  assert.equal(pool.ends, 1);
  assert.equal(process.listenerCount("SIGTERM"), signalListeners);
});

test("schema startup failure releases the database pool", async () => {
  const pool = fakePool(false);
  await assert.rejects(startServer(loadApiConfig(), pool), /schema is out of date/);
  assert.equal(pool.ends, 1);
});

test("successful API startup resolves only after listening and shuts down cleanly", async (t) => {
  const pool = fakePool();
  const log = t.mock.method(console, "log", () => {});
  const api = await startServer({ ...loadApiConfig(), apiPort: 0 }, pool);
  t.after(() => api.shutdown());
  assert.equal(api.server.listening, true);
  assert.match(log.mock.calls[0].arguments[0], new RegExp(`:${api.server.address().port} `));
  await api.shutdown();
  assert.equal(pool.ends, 1);
});
