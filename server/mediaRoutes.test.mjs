import assert from "node:assert/strict";
import test from "node:test";
import { registerMediaRoutes } from "./routes/mediaRoutes.mjs";

test("photo order route returns a stale boundary move as a harmless no-op", async () => {
  let orderHandler;
  const app = {
    get() {},
    put() {},
    post() {},
    delete() {},
    patch(path, _middleware, handler) {
      if (path === "/api/media-assets/:id/order") orderHandler = handler;
    },
  };
  const context = {
    assignedEditableCemeteryIds: () => [],
    canEditCemetery: () => true,
    createHeadstonePhoto: async () => undefined,
    express: { raw: () => (_request, _response, next) => next() },
    moveMediaAssetLink: async () => ({ moved: false, updates: [] }),
    pool: {},
    requireCemeteryAdmin: (_request, _response, next) => next(),
    requirePowerUser: (_request, _response, next) => next(),
    softDeleteMediaAsset: async () => undefined,
  };
  registerMediaRoutes(app, context);

  let statusCode = 200;
  let body;
  await orderHandler(
    {
      params: { id: "55555555-5555-4555-8555-555555555555" },
      body: {
        linkId: "66666666-6666-4666-8666-666666666666",
        linkType: "headstone",
        direction: "earlier",
      },
      user: { role: "admin" },
    },
    {
      status(value) {
        statusCode = value;
        return this;
      },
      json(value) {
        body = value;
      },
    },
    (error) => {
      throw error;
    },
  );

  assert.equal(statusCode, 200);
  assert.deepEqual(body, { moved: false, updates: [] });
});

test("retired gravesite upload route refuses uploads without creating records or files", async () => {
  let retired;
  const app = { get() {}, put() {}, post(path, ...handlers) { if (path.includes('grave-spaces')) retired = handlers.at(-1); }, delete() {}, patch() {} };
  registerMediaRoutes(app, {
    express: { raw() { return () => {}; } }, requirePowerUser() {}, requireCemeteryAdmin() {},
    pool: { query() { throw new Error('Retired upload must not access the database'); } },
  });
  let status, body;
  retired({}, {status(value) {status=value;return this;},json(value) {body=value;}});
  assert.equal(status,410);assert.match(body.error,/attached to a monument/);
});
