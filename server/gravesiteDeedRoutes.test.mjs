import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerGravesiteDeedRoutes, validateDeedUpload } from "./routes/gravesiteDeedRoutes.mjs";

const cemeteryId = "11111111-1111-4111-8111-111111111111";
const graveId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const pdf = Buffer.from("%PDF-1.7\n%%EOF\n");
const admin = { role: "admin", id: userId };
const editor = { role: "power-user", id: userId, cemeteryAccess: [{ cemeteryId, canEdit: true }] };

test("deed uploads require a PDF signature and a safe PDF filename", () => {
  assert.equal(validateDeedUpload("Signed deed.PDF", pdf), "Signed deed.PDF");
  for (const name of ["../deed.pdf", "directory\\deed.pdf", "deed.txt"]) {
    assert.throws(() => validateDeedUpload(name, pdf), /Choose a PDF/);
  }
  assert.throws(() => validateDeedUpload("fake.pdf", Buffer.from("not a PDF")), /Choose a PDF/);
  assert.throws(() => validateDeedUpload("truncated.pdf", Buffer.from("%PDF-1.7\n")), /Choose a PDF/);
});

test("deeds use scoped access, audited private storage, and attachment downloads", async (t) => {
  const uploadRoot = await mkdtemp(join(tmpdir(), "cemetery-deeds-"));
  t.after(() => rm(uploadRoot, { recursive: true, force: true }));
  const routes = {};
  let asset;
  let link;
  const queries = [];
  const pool = {
    async connect() {
      return {
        release() {},
        async query(sql, values) {
          queries.push(sql.trim());
          if (sql.includes("FOR UPDATE")) return { rows: values[1] === graveId ? [{ id: graveId }] : [] };
          if (sql.includes("INSERT INTO media_assets")) {
            const [id, cemetery, storage_key, , filename] = values;
            asset = { id, cemetery, storage_key, filename };
          }
          if (sql.includes("INSERT INTO gravesite_media_assets")) link = values;
          return { rows: [] };
        },
      };
    },
    async query(sql, values) {
      assert.match(sql, /asset\.content_type = 'application\/pdf'/);
      assert.match(sql, /link\.deleted_at IS NULL/);
      return { rows: asset && values[0] === asset.cemetery && values[1] === link[1]
        && (values.length === 2 || values[2] === asset.id) ? [asset] : [] };
    },
  };
  const pass = (_req, _res, next) => next();
  registerGravesiteDeedRoutes({
    get(path, ...handlers) { routes[path.endsWith(":deedId") ? "download" : "list"] = handlers; },
    post(_path, ...handlers) { routes.upload = handlers; },
  }, { express: { raw: () => pass }, pool, requireReader: pass, requireCemeteryAdmin: pass, uploadRoot });

  async function call(action, user, params = {}) {
    const result = { status: 200, headers: {} };
    const request = { user, params: { cemeteryId, id: graveId, ...params }, query: { filename: "Deed.pdf" }, body: pdf };
    const response = {
      locals: {},
      set(name, value) { result.headers[name] = value; },
      status(code) { result.status = code; return this; },
      json(body) { result.body = body; },
      download(key, filename, options) { result.attachment = { key, filename, options }; },
    };
    let index = 0;
    const pending = [];
    function next(error) {
      if (error) throw error;
      const handler = routes[action][index++];
      if (handler) pending.push(handler(request, response, next));
    }
    next();
    await Promise.all(pending);
    return result;
  }

  assert.equal((await call("upload", editor)).status, 403);
  assert.equal((await call("list", { role: "reader" })).status, 403);
  const uploaded = await call("upload", admin);
  assert.equal(uploaded.status, 201);
  assert.deepEqual(link, [uploaded.body.id, graveId, userId]);
  assert.equal(queries.at(-1), "COMMIT");
  assert.deepEqual(await readdir(uploadRoot), [`${uploaded.body.id}.pdf`]);
  assert.deepEqual(await readFile(join(uploadRoot, asset.storage_key)), pdf);
  assert.deepEqual((await call("list", editor)).body, [uploaded.body]);
  const download = await call("download", editor, { deedId: uploaded.body.id });
  assert.equal(download.attachment.filename, "Deed.pdf");
  assert.equal(download.headers["Cache-Control"], "private, no-store");
  assert.equal(download.headers["X-Content-Type-Options"], "nosniff");
  assert.equal((await call("download", editor, { deedId: uploaded.body.id, id: userId })).status, 404);
  assert.equal((await call("download", editor, { deedId: uploaded.body.id, cemeteryId: userId })).status, 403);
});
