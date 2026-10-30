import { expect, test } from "@playwright/test";
import { ApiError } from "../src/api/apiClient";
import { abortableDelay, retryTransient } from "../src/api/retry";
import { fixture } from "./fixtures/cemetery";

for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 501]) {
  test(`permanent HTTP ${status} errors are not retried`, async () => {
    let calls = 0;
    const error = new ApiError("Permanent", status);
    await expect(retryTransient(async () => { calls++; throw error; })).rejects.toBe(error);
    expect(calls).toBe(1);
  });
}

test("transient errors retry with a bounded backoff and return the final response", async () => {
  let calls = 0; const delays: number[] = [];
  const value = await retryTransient(async () => {
    if (++calls < 3) throw new ApiError("Temporary", calls === 1 ? 0 : 503);
    return "ready";
  }, { delay: async (ms) => { delays.push(ms); } });
  expect(value).toBe("ready"); expect(delays).toEqual([200, 400]);
  const error = new ApiError("Unavailable", 503);
  await expect(retryTransient(async () => { throw error; }, { attempts: 2, delay: async () => {} })).rejects.toBe(error);
  await expect(retryTransient(async () => "", { attempts: 0 })).rejects.toBeInstanceOf(RangeError);
});

test("aborting a retry delay stops further attempts; malformed responses are not retried", async () => {
  const controller = new AbortController(); let calls = 0;
  const result = retryTransient(async () => { calls++; throw new ApiError("Temporary", 503); }, {
    signal: controller.signal,
    delay: (ms, signal) => { const waiting = abortableDelay(ms, signal); controller.abort(); return waiting; },
  });
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(calls).toBe(1);
  await expect(retryTransient(async () => { throw new SyntaxError("Invalid JSON"); })).rejects.toBeInstanceOf(SyntaxError);
});

test("map startup reports authorization errors after one request", async ({ page }) => {
  await fixture(page); let requests = 0;
  await page.route("**/api/cemetery-map", (route) => { requests++; return route.fulfill({ status: 403, json: {} }); });
  await page.goto("/");
  await expect(page.getByText("You don't have permission to perform this action. Contact an administrator if you need access.")).toBeVisible();
  expect(requests).toBe(1);
});
