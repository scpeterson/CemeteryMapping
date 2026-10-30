import { expect, test } from "@playwright/test";
import { summaries } from "./fixtures/cemetery";
import { overviewFixture } from "./fixtures/overview";

for (const from of ["grave", "marker"] as const) {
  test(`switching away from a pending ${from} aborts its request without showing an error`, async ({ page }) => {
    await overviewFixture(page);
    const pendingPath = from === "grave" ? `/grave-spaces/${summaries[0].id}` : "/headstones/marker-1";
    await page.addInitScript((path) => {
      const originalFetch = window.fetch.bind(window);
      const requests = { started: false, aborted: false };
      Object.assign(window, { detailRequests: requests });
      window.fetch = (input, init) => {
        if (String(input).endsWith(path)) {
          requests.started = true;
          return new Promise<Response>((_resolve, reject) => {
            const abort = () => { requests.aborted = true; reject(new DOMException("Aborted", "AbortError")); };
            if (init?.signal?.aborted) abort();
            else init?.signal?.addEventListener("abort", abort, { once: true });
          });
        }
        return originalFetch(input, init);
      };
    }, pendingPath);
    await page.goto("/");
    if (from === "grave") {
      await page.locator(".result-card").filter({ hasText: "A-TEST" }).first().click();
    } else {
      await page.getByLabel("Search cemetery records").fill("HS-OVERVIEW");
      await page.locator(".result-card").filter({ hasText: "Monument ID:" }).click();
    }
    await expect.poll(() => page.evaluate(() => (window as unknown as { detailRequests: { started: boolean } }).detailRequests.started)).toBe(true);
    await page.getByLabel("Search cemetery records").fill("");
    await page.locator(".result-card").filter({ hasText: "B-TEST" }).first().click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { detailRequests: { aborted: boolean } }).detailRequests.aborted)).toBe(true);
    await expect(page.locator(".detail-panel")).toContainText("Record ID: B-TEST");
    await expect(page.getByText(/Unable to load (grave|marker) details/)).toHaveCount(0);
  });
}
