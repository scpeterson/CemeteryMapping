import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./index.mjs";

test("full middleware chain uploads to custom storage and revokes downloads after deletion", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "media-lifecycle-"));
  const previous = process.env.MEDIA_UPLOAD_DIR;
  process.env.MEDIA_UPLOAD_DIR = root;
  t.after(async () => { if (previous === undefined) delete process.env.MEDIA_UPLOAD_DIR; else process.env.MEDIA_UPLOAD_DIR = previous; await rm(root, { recursive: true }); });
  let asset;
  let deleted = false;
  const cemeteryId = "11111111-1111-4111-8111-111111111111";
  const query = async (sql, values = []) => {
    if (sql.includes("INSERT INTO media_assets")) {
      asset = { id: values[0], cemetery_id: cemeteryId, storage_key: values[2], file_url: values[3], content_type: values[5] };
      return { rows: [asset] };
    }
    if (sql.includes("FROM headstones")) return { rows: [{ id: "22222222-2222-4222-8222-222222222222", cemetery_id: cemeteryId }] };
    if (sql.includes("FROM media_assets")) return { rows: asset && (!sql.includes("deleted_at IS NULL") || !deleted) ? [asset] : [] };
    if (sql.includes("UPDATE media_assets")) { deleted = true; return { rows: [{ ...asset, deleted_at: new Date().toISOString() }] }; }
    return { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const app = createApp({ appEnv: "test", database: {}, auth: { mode: "trusted-header", roleHeader: "x-role", emailHeader: "x-email", subjectHeader: "x-sub", auth0: {} } }, pool);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "x-role": "admin", "x-email": "test@example.test" };
  const upload = await fetch(`${base}/api/headstones/22222222-2222-4222-8222-222222222222/media-assets`, {
    method: "POST", headers: { ...headers, "Content-Type": "image/jpeg" }, body: Buffer.from("photo fixture"),
  });
  assert.equal(upload.status, 201);
  const photo = await upload.json();
  assert.deepEqual(await readdir(root), [asset.storage_key]);
  assert.equal((await fetch(`${base}${photo.fileUrl}`)).status, 401);
  const downloaded = await fetch(`${base}${photo.fileUrl}`, { headers });
  assert.equal(downloaded.status, 200);
  assert.equal(await downloaded.text(), "photo fixture");
  const deletion = await fetch(`${base}/api/media-assets/${photo.id}`, {
    method: "DELETE", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Test removal" }),
  });
  assert.equal(deletion.status, 200);
  assert.equal((await fetch(`${base}${photo.fileUrl}`, { headers })).status, 404);
  assert.deepEqual(await readdir(root), [asset.storage_key], "Deleted evidence remains on disk but is inaccessible");
});
