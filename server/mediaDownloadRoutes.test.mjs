import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { requireRole } from "./auth.mjs";
import { registerMediaDownloadRoutes } from "./routes/mediaDownloadRoutes.mjs";

test("media downloads require a reader and an undeleted database asset", async (t) => {
  const uploadRoot = await mkdtemp(join(tmpdir(), "media-download-"));
  const key = "11111111-1111-4111-8111-111111111111.jpg";
  await writeFile(join(uploadRoot, key), "photo fixture");
  let deleted = false;
  let queries = 0;
  const app = express();
  registerMediaDownloadRoutes(app, {
    uploadRoot,
    requireReader: requireRole({ mode: "trusted-header", roleHeader: "x-role", emailHeader: "x-email", subjectHeader: "x-sub" }, "reader"),
    pool: { async query(sql, values) {
      queries++;
      assert.match(sql, /deleted_at IS NULL/);
      assert.deepEqual(values, [key]);
      return { rows: deleted ? [] : [{ id: key }] };
    } },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(uploadRoot, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/media/${key}`)).status, 401);
  assert.equal(queries, 0);
  const headers = { "x-role": "reader", "x-email": "reader@example.test" };
  const response = await fetch(`${base}/media/${key}`, { headers });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(await response.text(), "photo fixture");
  deleted = true;
  assert.equal((await fetch(`${base}/media/${key}`, { headers })).status, 404);
  assert.equal((await fetch(`${base}/media/not-an-asset.jpg`, { headers })).status, 404);
});
