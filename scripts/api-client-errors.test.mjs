import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, authorizedFetch, jsonResponse, setAccessTokenProvider } from "../src/api/apiClient.ts";

for (const [status, body, expected] of [
  [400, { error: "Birth date is invalid." }, /Birth date is invalid/],
  [401, { error: "Unauthorized" }, /Sign in again/],
  [403, { error: "Forbidden" }, /don't have permission/],
  [404, {}, /no longer available/],
  [409, { error: "Reload the latest values before saving." }, /Reload the latest values/],
  [413, { error: "This photo exceeds the 25 MB upload limit. Choose a smaller file." }, /25 MB/],
  [415, {}, /not supported/],
  [429, {}, /Wait a moment/],
  [500, { error: "private SQL detail", referenceId: "test-reference" }, /Reference: test-reference/],
  [502, null, /Something went wrong/],
]) {
  test(`HTTP ${status} provides guidance and retains diagnostic status`, async () => {
    const response = new Response(body ? JSON.stringify(body) : "<html>Bad gateway</html>", { status });
    await assert.rejects(jsonResponse(response, "Update burial API"), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.operation, "Update burial API");
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /API returned|private SQL/);
      if (status === 500) assert.equal(error.referenceId, "test-reference");
      return true;
    });
  });
}

test("network and authentication failures are actionable, cancellation stays cancellation", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(authorizedFetch("/api/test"), /Couldn't reach the server/);
  const abort = new DOMException("Cancelled", "AbortError");
  globalThis.fetch = async () => { throw abort; };
  await assert.rejects(authorizedFetch("/api/test"), (error) => error === abort);
  setAccessTokenProvider(async () => { throw new Error("private auth detail"); });
  try {
    await assert.rejects(authorizedFetch("/api/test"), /Sign in again/);
  } finally { setAccessTokenProvider(undefined); }
});
