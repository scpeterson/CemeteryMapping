import assert from "node:assert/strict";
import { once } from "node:events";
import { gzipSync } from "node:zlib";
import test from "node:test";
import express from "express";

test("malformed compressed JSON cannot crash the parser or prevent the next request", async (t) => {
  const app = express();
  app.use(express.json());
  app.post("/", (req, res) => res.json(req.body));
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status ?? 500).json({ error: "Invalid body" });
  });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/`;
  const malformed = Buffer.concat([gzipSync('{"ok":true}'), Buffer.from("invalid trailing gzip data")]);
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
    body: malformed, signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 400);
  await response.arrayBuffer();
  const next = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"ok":true}',
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(next.status, 200);
  assert.deepEqual(await next.json(), { ok: true });
});
