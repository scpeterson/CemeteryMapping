import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { createGracefulShutdown } from "./shutdown.mjs";

test("shutdown waits for an in-flight request before closing the pool", async () => {
  let finishRequest;
  let requestStarted;
  const started = new Promise((resolve) => { requestStarted = resolve; });
  const server = http.createServer((_request, response) => {
    finishRequest = () => response.end("saved");
    requestStarted();
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  let poolEnds = 0;
  const shutdown = createGracefulShutdown(server, { end: async () => { poolEnds++; } });
  const request = fetch(`http://127.0.0.1:${server.address().port}`);
  await started;
  const stopping = shutdown();
  assert.equal(shutdown(), stopping);
  assert.equal(poolEnds, 0);
  finishRequest();
  assert.equal(await (await request).text(), "saved");
  await stopping;
  assert.equal(poolEnds, 1);
});

test("shutdown deadline forces connections closed and releases the pool once", async () => {
  let forced = 0;
  let ended = 0;
  const shutdown = createGracefulShutdown({ close() {}, closeAllConnections() { forced++; } }, { end: async () => { ended++; } }, { timeoutMs: 10 });
  await assert.rejects(shutdown(), /shutdown exceeded/);
  assert.equal(forced, 1);
  assert.equal(ended, 1);
});

test("shutdown deadline also bounds a stalled pool close", async () => {
  const shutdown = createGracefulShutdown({ close(callback) { callback(); }, closeAllConnections() {} }, { end: () => new Promise(() => {}) }, { timeoutMs: 10 });
  await assert.rejects(shutdown(), /shutdown exceeded/);
});
