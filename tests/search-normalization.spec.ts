import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, summaries } from "./fixtures/cemetery";

test("local map fallback matches accented labels without changing displayed spelling", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: { boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry }], sections: [], lots: [], graves: [{ ...summaries[0], section: "García" }], headstones: [] } }));
  await page.route("**/api/search**", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/");
  await page.getByLabel("Search cemetery records").fill("garcia");
  await expect(page.locator(".search-panel")).toContainText("Search is unavailable");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card")).toContainText("García");
});
