import { expect, test } from "@playwright/test";
import { createMediaDownloads } from "../src/lib/sharedMediaDownloads";
import { overviewFixture } from "./fixtures/overview";
import { select } from "./fixtures/cemetery";

// The injected boundary verifies resource lifetime without browser timing or network caches.
test("concurrent consumers share a download and retain its URL until the final release", async () => {
  let fetches = 0, urls = 0; const revoked: string[] = [];
  const downloads = createMediaDownloads({ fetchBlob: async () => { fetches++; return new Blob(); },
    createUrl: () => `blob:${++urls}`, revokeUrl: (url) => revoked.push(url) });
  const a = downloads.acquire("photo"), b = downloads.acquire("photo");
  expect(await a.promise).toBe(await b.promise); expect(fetches).toBe(1);
  a.release(); a.release(); expect(revoked).toEqual([]);
  b.release(); expect(revoked).toEqual(["blob:1"]);
  const c = downloads.acquire("photo"); await c.promise; expect(fetches).toBe(2); c.release();
});

test("pending downloads abort only after the last release and failures can be retried", async () => {
  let signal!: AbortSignal;
  const downloads = createMediaDownloads({ fetchBlob: (_source, current) => {
    signal = current;
    return new Promise((_resolve, reject) => current.addEventListener("abort", () => reject(current.reason), { once: true }));
  } });
  const a = downloads.acquire("photo"), b = downloads.acquire("photo");
  const failure = expect(a.promise).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve(); a.release(); expect(signal.aborted).toBe(false);
  b.release(); expect(signal.aborted).toBe(true); await failure;
  let calls = 0;
  const retryable = createMediaDownloads({ fetchBlob: async () => {
    if (++calls === 1) throw new Error("Unavailable");
    return new Blob();
  }, createUrl: () => "blob:recovered", revokeUrl: () => {} });
  const failed = retryable.acquire("photo"); await expect(failed.promise).rejects.toThrow("Unavailable");
  const retried = retryable.acquire("photo"); expect(await retried.promise).toBe("blob:recovered");
  failed.release(); retried.release();
});

test("session invalidation disposes active and superseded retry URLs", async () => {
  const revoked: string[] = []; let urls = 0;
  const downloads = createMediaDownloads({ fetchBlob: async () => new Blob(),
    createUrl: () => `blob:${++urls}`, revokeUrl: (url) => revoked.push(url) });
  const a = downloads.acquire("photo"); await a.promise;
  const b = downloads.acquire("photo", true); await b.promise;
  downloads.clear(); a.release(); b.release();
  expect(revoked).toEqual(["blob:1", "blob:2"]);
});

test("preview and expanded original share one download, then reload on session change", async ({ page }) => {
  await overviewFixture(page); let downloads = 0;
  await page.route("**/media/latest-marker.png", async (route) => { downloads++; await route.fallback(); });
  await page.goto("/tests/auth.html");
  await select(page, "A-TEST");
  const preview = page.getByRole("tabpanel", { name: "Overview", exact: true });
  await expect(preview.getByRole("img", { name: "latest-marker" })).toBeVisible();
  const before = downloads;
  await preview.getByRole("button", { name: "Open latest photo" }).click();
  await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
  expect(downloads).toBe(before);
  await page.keyboard.press("Escape");
  await expect(preview.getByRole("img", { name: "latest-marker" })).toBeVisible();
  await page.evaluate(async () => {
    const api = await import("/src/api/apiClient.ts");
    api.setAccessTokenProvider(async () => "new-session");
  });
  await expect.poll(() => downloads).toBe(before + 1);
  await expect(preview.getByRole("img", { name: "latest-marker" })).toBeVisible();
});
