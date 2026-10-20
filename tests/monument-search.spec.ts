import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, summaries } from "./fixtures/cemetery";
import { marker, markerSummary } from "./fixtures/overview";

for (const standalone of [false, true]) {
  test(`monument ID search opens ${standalone ? "standalone" : "associated"} monument directly`, async ({ page }) => {
    await fixture(page);
    await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
      boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry: { ...geometry, coordinates: [[[-81,39],[-79,39],[-79,41],[-81,41],[-81,39]]] } }],
      sections: [], lots: [], graves: summaries,
      headstones: [{ ...markerSummary, headstoneId: "TLC-HS-0270", gravesiteId: standalone ? null : "A-TEST" }],
    } }));
    await page.route("**/api/search**", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: { ...marker, headstoneId: "TLC-HS-0270", associatedGravesiteIds: standalone ? [] : ["A-TEST"] } }));
    await page.goto("/");
    const scale = page.locator(".map-scale-fraction");
    const scaleValue = async () => Number((await scale.innerText()).split(":")[1].replaceAll(",", ""));
    await expect.poll(scaleValue).toBeGreaterThan(10000);
    await page.getByLabel("Search cemetery records").fill("tlc-hs-0270");
    const result = page.locator(".result-card").filter({ hasText: "Monument ID: TLC-HS-0270" });
    await expect(result).toHaveCount(1);
    await result.click();
    await expect(page.locator(".detail-panel")).toContainText("TLC-HS-0270");
    await expect(result).toHaveAttribute("aria-current", "true");
    await expect.poll(scaleValue).toBeLessThan(10000);
    await page.getByLabel("Search cemetery records").fill("HS-027");
    await expect(result).toHaveCount(1);
    await page.getByLabel("Search cemetery records").fill("TLC-HS-9999");
    await expect(page.locator(".result-card")).toHaveCount(0);
  });
}
