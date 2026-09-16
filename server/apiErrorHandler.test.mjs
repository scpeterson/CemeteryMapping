import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createApiErrorHandler } from "./apiErrorHandler.mjs";
import { validateBurialPayload } from "./routes/cemeteryRouteValidation.mjs";
import { BadRequestError, ConflictError } from "./requestValidation.mjs";

test("actual parser failures preserve 400 and 413 without recording server errors", async (t) => {
  const app = express();
  app.use(express.json({ limit: "20b" }));
  app.post("/body", (_request, response) => response.sendStatus(204));
  app.get("/conflict", () => { throw new ConflictError(); });
  app.get("/invalid-burial-date", () => { validateBurialPayload({ firstName: "Alice", birthDate: "2002-11-31" }); });
  app.get("/bad", () => { throw new BadRequestError("Name is required"); });
  app.get("/unknown", () => { throw Object.assign(new Error("private detail"), { status: 400 }); });
  let recorded = 0;
  let recordedMetadata;
  app.use(createApiErrorHandler({ query: async (_sql, values) => { recorded++; recordedMetadata = JSON.parse(values[14]); return { rows: [{}] }; } }, { appEnv: "test" }, {}));
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
  assert.equal((await fetch(`${base}/conflict`)).status, 409);
  const invalidDate = await fetch(`${base}/invalid-burial-date`);
  assert.equal(invalidDate.status, 400);
  assert.deepEqual(await invalidDate.json(), { error: 'Birth date "2002-11-31" is not a valid calendar date. Check the year, month, and day.' });
  assert.equal(recorded, 0);
  const unknown = await fetch(`${base}/unknown`);
  assert.equal(unknown.status, 500);
  const failure = await unknown.json();
  assert.match(failure.error, /Something went wrong on the server/);
  assert.match(failure.referenceId, /^[0-9a-f-]{36}$/u);
  assert.ok(!JSON.stringify(failure).includes("private detail"));
  assert.ok(recorded > 0);
  assert.equal(recordedMetadata.referenceId, failure.referenceId);
});

test("errors after response headers are delegated without writing again", async () => {
  const error = new Error("stream failed");
  let delegated;
  await createApiErrorHandler({}, {}, {})(error, {}, { headersSent: true }, (value) => { delegated = value; });
  assert.equal(delegated, error);
});

test("oversized photos report the upload limit without logging a server failure", async () => {
  let status, body;
  const response = { status(code) { status = code; return this; }, json(value) { body = value; } };
  await createApiErrorHandler({}, {}, {})({ type: "entity.too.large" }, { originalUrl: "/api/headstones/marker/media-assets?filename=photo.jpg" }, response);
  assert.equal(status, 413);
  assert.equal(body.error, "This photo exceeds the 25 MB upload limit. Choose a smaller file.");
});
