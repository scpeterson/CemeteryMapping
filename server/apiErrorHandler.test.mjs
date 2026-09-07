import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createApiErrorHandler } from "./apiErrorHandler.mjs";
import { BadRequestError } from "./requestValidation.mjs";

test("actual parser failures preserve 400 and 413 without recording server errors", async (t) => {
  const app = express();
  app.use(express.json({ limit: "20b" }));
  app.post("/body", (_request, response) => response.sendStatus(204));
  app.get("/bad", () => { throw new BadRequestError("Name is required"); });
  app.get("/unknown", () => { throw Object.assign(new Error("private detail"), { status: 400 }); });
  let recorded = 0;
  app.use(createApiErrorHandler({ query: async () => { recorded++; return { rows: [] }; } }, { appEnv: "test" }, {}));
  t.mock.method(console, "error", () => {});
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [body, status] of [["{", 400], [JSON.stringify({ text: "a".repeat(30) }), 413]]) {
    const response = await fetch(`${base}/body`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal(response.status, status);
  }
  assert.equal((await fetch(`${base}/bad`)).status, 400);
  assert.equal(recorded, 0);
  const unknown = await fetch(`${base}/unknown`);
  assert.equal(unknown.status, 500);
  assert.deepEqual(await unknown.json(), { error: "Internal server error" });
  assert.ok(recorded > 0);
});

test("errors after response headers are delegated without writing again", async () => {
  const error = new Error("stream failed");
  let delegated;
  await createApiErrorHandler({}, {}, {})(error, {}, { headersSent: true }, (value) => { delegated = value; });
  assert.equal(delegated, error);
});
