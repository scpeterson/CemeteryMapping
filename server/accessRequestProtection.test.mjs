import assert from "node:assert/strict";
import test from "node:test";
import { accessRequestIp, verifyAccessRequestToken } from "./accessRequestProtection.mjs";
import { accessRequestLimiter, registerAccessRequestRoutes } from "./routes/accessRequestRoutes.mjs";
import express from "express";

const settings = { required: true, secret: "unit-test-secret", hostnames: ["test.nhcemeteries.org"] };
const valid = { success: true, hostname: "test.nhcemeteries.org", action: "request_access" };
test("verification requires an authentic single-use token for this host and action, and fails closed", async () => {
  let calls = 0;
  const verify = async (_url, options) => {
    calls++;
    assert.equal(options.body.get("response"), "fresh-token");
    assert.equal(options.body.get("remoteip"), "192.0.2.1");
    assert.ok(options.signal);
    return { ok: true, json: async () => calls === 1 ? valid : { success: false, "error-codes": ["timeout-or-duplicate"] } };
  };
  for (const token of [undefined, "", {}, "x".repeat(2049)]) assert.equal(await verifyAccessRequestToken(token, "192.0.2.1", settings, verify), false);
  assert.equal(calls, 0);
  assert.equal(await verifyAccessRequestToken("fresh-token", "192.0.2.1", settings, verify), true);
  assert.equal(await verifyAccessRequestToken("fresh-token", "192.0.2.1", settings, verify), false);
  for (const result of [null, { ...valid, success: "true" }, { ...valid, action: "login" }, { ...valid, hostname: "nhcemeteries.org" }, { ...valid, hostname: "localhost" }]) {
    assert.equal(await verifyAccessRequestToken("token", "192.0.2.1", settings, async () => ({ ok: true, json: async () => result })), false);
  }
  for (const fetchImpl of [async () => { throw new Error("network timeout"); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } })]) {
    assert.equal(await verifyAccessRequestToken("token", "192.0.2.1", settings, fetchImpl), false);
  }
  assert.equal(await verifyAccessRequestToken("token", "192.0.2.1", { ...settings, secret: undefined }), false);
  assert.equal(await verifyAccessRequestToken("token", "192.0.2.1", { ...settings, hostnames: [] }), false);
  assert.equal(await verifyAccessRequestToken("token", "192.0.2.1"), false);
});

test("visitor IP headers are trusted only from an explicitly enabled loopback proxy", () => {
  const req = { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" }, headers: { "x-access-request-ip": "192.0.2.1", "x-forwarded-for": "192.0.2.2" } };
  assert.equal(accessRequestIp(req), "127.0.0.1");
  assert.equal(accessRequestIp(req, true), "192.0.2.1");
  assert.equal(accessRequestIp({ ...req, socket: { remoteAddress: "192.0.2.3" } }, true), "127.0.0.1");
  assert.equal(accessRequestIp({ ...req, headers: { "x-access-request-ip": "invalid" } }, true), "127.0.0.1");
});

test("distributed visitors still hit a global ceiling and the ceiling resets", () => {
  let time = 0, allowed = 0, blocked = 0;
  const limiter = accessRequestLimiter({ globalLimit: 2, now: () => time, windowMs: 1000 });
  const res = { set() { return this; }, status(code) { assert.equal(code, 429); blocked++; return this; }, json() {} };
  for (let i = 0; i < 3; i++) limiter({ ip: `192.0.2.${i}` }, res, () => allowed++);
  assert.equal(allowed, 2); assert.equal(blocked, 1);
  time = 1001; limiter({ ip: "192.0.2.4" }, res, () => allowed++);
  assert.equal(allowed, 3);
});

test("failed verification and oversized bodies never reach the database", async (t) => {
  const app = express();
  registerAccessRequestRoutes(app, { pool: { connect: () => { throw new Error("Must not access database"); } }, requireAdmin: (_req, res) => res.sendStatus(401), protection: settings, verifyToken: async () => false });
  app.use((error, _req, res, next) => { if (res.headersSent) return next(error); res.status(error.status ?? 500).json({ error: error.message }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/access-requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const input = { email: "visitor@example.test", displayName: "Visitor", cemeteryInterest: "Trinity", reason: "Research" };
  assert.equal((await post(input)).status, 403);
  assert.equal((await post({ ...input, turnstileToken: "forged" })).status, 403);
  assert.equal((await post({ ...input, padding: "x".repeat(17_000) })).status, 413);
});

test("a blocked visitor cannot consume the remaining shared verification budget", () => {
  let allowed = 0;
  const limiter = accessRequestLimiter({ limit: 1, globalLimit: 2 });
  const response = { set() { return this; }, status() { return this; }, json() {} };
  limiter({ ip: "192.0.2.1" }, response, () => allowed++);
  for (let i = 0; i < 100; i++) limiter({ ip: "192.0.2.1" }, response, () => allowed++);
  limiter({ ip: "192.0.2.2" }, response, () => allowed++);
  assert.equal(allowed, 2);
});
