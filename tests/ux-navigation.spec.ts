import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, select, summaries } from "./fixtures/cemetery";

const otherId = "22222222-2222-4222-8222-222222222222";
const other = { ...summaries[0], id: "OTHER", cemeteryId: otherId, cemeteryName: "Other Cemetery" };

test("cemetery scope filters local and remote results and resets selection", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
    boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry }, { type: "Feature", properties: { id: otherId, name: "Other Cemetery" }, geometry }],
    sections: [], lots: [], graves: [...summaries, other], headstones: [],
  } }));
  await page.route("**/api/search**", (route) => route.fulfill({ json: [...summaries, other].map((grave) => ({ grave, reasons: [grave.id] })) }));
  await page.goto("/tests/auth.html");
  await expect(page.locator(".result-card")).toHaveCount(3);
  await select(page, "A-TEST");
  await page.getByLabel("Cemetery", { exact: true }).selectOption(otherId);
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card")).toContainText("Other Cemetery");
  await expect(page.locator(".detail-panel")).toContainText("Select a grave site");
  await expect(page.getByRole("button", { name: "Fit selected cemetery" })).toBeVisible();
  await expect(page.locator(".cemetery-map-marker")).toHaveCount(1);
  await expect(page.locator(".cemetery-map-marker")).toContainText("Other Cemetery");
  await page.getByLabel("Search cemetery records").fill("");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await page.getByLabel("Cemetery", { exact: true }).selectOption("");
  await expect(page.locator(".result-card")).toHaveCount(3);
});

test("single status, reset and legend disclosure work", async ({ page }) => {
  await fixture(page);
  await page.goto("/tests/auth.html");
  await expect(page.locator(".result-card")).toHaveCount(2);
  await page.getByLabel("Show one status").selectOption("occupied");
  await expect(page.locator(".result-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".result-card")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Layers", exact: true })).toBeHidden();
  await page.locator(".map-legend summary").click();
  await expect(page.getByRole("heading", { name: "Layers", exact: true })).toBeVisible();
  await page.locator(".map-legend summary").press("Enter");
  await expect(page.getByRole("heading", { name: "Layers", exact: true })).toBeHidden();
});

for (const width of [320, 390, 1280]) {
  test(`navigation remains usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await fixture(page);
    await page.goto("/tests/auth.html");
    if (width < 761) {
      await expect(page.locator(".map-region")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Search", exact: true }).click();
      expect((await page.getByRole("button", { name: "Available", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await select(page, "A-TEST");
    for (const tab of await page.getByRole("tab").all()) {
      const box = (await tab.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await expect(page.getByRole("tab", { name: "Maintenance records and evidence" })).toContainText("Maintenance");
    await page.screenshot({ path: testInfo.outputPath(`ux-${width}.png`), fullPage: true });
  });
}


test("the first selected gravesite zooms the map", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
    boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry: {
      type: "Polygon", coordinates: [[[-81,39],[-79,39],[-79,41],[-81,41],[-81,39]]],
    } }], sections: [], lots: [], graves: summaries, headstones: [],
  } }));
  await page.goto("/tests/auth.html");
  const scale = page.locator(".map-scale-fraction");
  await expect(scale).toBeVisible();
  await expect(page.locator(".cemetery-map-marker")).toBeVisible();
  await expect.poll(async () => Number((await scale.innerText()).split(":")[1].replaceAll(",", ""))).toBeGreaterThan(10000);
  await select(page, "A-TEST");
  await expect.poll(async () => Number((await scale.innerText()).split(":")[1].replaceAll(",", ""))).toBeLessThan(10000);
});

for (const role of ["reader", "power-user", "cemetery-admin"]) {
  test(`${role} automatically opens only their registered cemetery`, async ({ page }) => {
    await fixture(page);
    let releaseUser!: () => void;
    const userReady = new Promise<void>((resolve) => { releaseUser = resolve; });
    await page.route("**/api/me", async (route) => {
      await userReady;
      await route.fulfill({ json: { role, assignedCemeteryIds: [cemeteryId], permissions: { canOpenAdminPanel: role === "cemetery-admin" } } });
    });
    await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
      boundaries: [
        { type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry },
        { type: "Feature", properties: { id: otherId, name: "Other Cemetery" }, geometry: {
          type: "Polygon", coordinates: [[[-77,39],[-76,39],[-76,40],[-77,40],[-77,39]]],
        } },
      ], sections: [], lots: [], graves: [...summaries, other], headstones: [],
    } }));
    await page.route("**/api/search**", (route) => route.fulfill({ json: [...summaries, other].map((grave) => ({ grave, reasons: [grave.id] })) }));
    await page.goto("/tests/auth.html");
    await expect(page.getByLabel("Cemetery", { exact: true })).toHaveCount(0);
    await expect(page.locator(".result-card")).toHaveCount(0);
    releaseUser();
    await expect(page.getByRole("banner")).toContainText("Test Cemetery");
    await expect(page.getByLabel("Cemetery", { exact: true })).toHaveCount(0);
    await expect(page.locator(".result-card")).toHaveCount(2);
    await expect(page.locator(".cemetery-map-marker")).toHaveCount(1);
    await expect(page.locator(".cemetery-map-marker")).toContainText("Test Cemetery");
    await expect.poll(async () => Number((await page.locator(".map-scale-fraction").innerText()).split(":")[1].replaceAll(",", ""))).toBeLessThan(10000);
    await page.getByLabel("Search cemetery records").fill("TEST");
    await expect(page.locator(".result-card")).toHaveCount(2);
    await expect(page.locator(".results-list")).not.toContainText("Other Cemetery");
    await expect(page.getByRole("button", { name: "Fit selected cemetery" })).toBeVisible();
  });
}

test("a missing registration does not fall back to all cemeteries", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "reader", assignedCemeteryIds: [], permissions: {} } }));
  await page.goto("/tests/auth.html");
  await expect(page.getByRole("banner")).toContainText("Contact your administrator to register one cemetery.");
  await expect(page.getByLabel("Cemetery", { exact: true })).toHaveCount(0);
  await expect(page.locator(".result-card")).toHaveCount(0);
  await expect(page.locator(".cemetery-map-marker")).toHaveCount(0);
});
