import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { requireRole } from "./auth.mjs";
import { registerAccessRequestRoutes, accessRequestLimiter } from "./routes/accessRequestRoutes.mjs";
import { validateAccessRequest } from "./accessRequestRepository.mjs";
import { BadRequestError } from "./requestValidation.mjs";

const input = { email: " Visitor@Example.test ", displayName: "Visitor", cemeteryInterest: "Trinity", reason: "Family research" };
test("public request validates bounded text and email", () => {
  assert.equal(validateAccessRequest(input).email, "visitor@example.test");
  for (const change of [{ email: "bad" }, { reason: "" }, { displayName: "x".repeat(251) }, { reason: "x".repeat(2001) }]) {
    assert.throws(() => validateAccessRequest({ ...input, ...change }), BadRequestError);
  }
});

test("request endpoint is public, generic and cannot grant roles; review requires global admin", async (t) => {
  const app = express(); app.use(express.json());
  const statements = [];
  const pool = { query: async (sql, values) => { statements.push({ sql, values }); return { rows: [] }; } };
  const config = { mode: "trusted-header", roleHeader: "x-role", emailHeader: "x-email", subjectHeader: "x-subject" };
  registerAccessRequestRoutes(app, { pool, requireAdmin: requireRole(config, "admin") });
  app.get("/api/cemeteries", requireRole(config, "reader"), (_req, res) => res.json([]));
  app.use((error, _req, res, next) => { if (res.headersSent) return next(error); res.status(error.statusCode ?? 500).json({ error: error.message }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${base}/api/access-requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const first = await post({ ...input, role: "admin", isActive: true });
  assert.equal(first.status, 202);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.deepEqual(await first.json(), await (await post(input)).json());
  assert.equal(statements.length, 2);
  assert.ok(statements.every(({ sql }) => !/INSERT INTO app_users|UPDATE app_users/.test(sql)));
  assert.equal((await post({ ...input, website: "bot" })).status, 202);
  assert.equal(statements.length, 2);
  assert.equal((await fetch(`${base}/api/cemeteries`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/access-requests`)).status, 401);
  for (const role of ["reader", "power-user", "cemetery-admin"]) {
    const headers = { "x-role": role, "x-email": "user@example.test" };
    assert.equal((await fetch(`${base}/api/admin/access-requests`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/api/admin/access-requests/11111111-1111-4111-8111-111111111111/reject`, { method: "POST", headers })).status, 403);
  }
  assert.equal((await fetch(`${base}/api/admin/access-requests`, { headers: { "x-role": "admin", "x-email": "admin@example.test" } })).status, 200);
});

test("public rate limiter rejects bursts and expires buckets", () => {
  let time = 0, allowed = 0, rejected = 0;
  const limiter = accessRequestLimiter({ now: () => time, limit: 2, windowMs: 1000 });
  const response = { set() { return this; }, status(code) { assert.equal(code, 429); rejected++; return this; }, json() {} };
  for (let i = 0; i < 3; i++) limiter({ ip: "127.0.0.1" }, response, () => allowed++);
  assert.equal(allowed, 2); assert.equal(rejected, 1);
  time = 1001; limiter({ ip: "127.0.0.1" }, response, () => allowed++);
  assert.equal(allowed, 3);
});

test("real application keeps record, media and admin routes private alongside the public form API", async (t) => {
  const { createApp } = await import("./index.mjs");
  const app = createApp({ appEnv: "test", auth: { mode: "trusted-header", roleHeader: "x-role", emailHeader: "x-email", subjectHeader: "x-subject", auth0: { management: {} } } }, {
    query: async () => { throw new Error("Anonymous requests must not query records"); },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/api/cemetery-map", "/api/search?q=smith", "/api/headstone-lookups", "/api/admin/users", "/api/admin/access-requests", "/media/photo.jpg"]) {
    assert.equal((await fetch(`${base}${path}`)).status, 401, path);
  }
});
