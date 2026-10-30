import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, summaries } from "./fixtures/cemetery";
import { markerSummary } from "./fixtures/overview";

const otherId = "22222222-2222-4222-8222-222222222222";

test("fallback searches graves, lots and monuments within the selected cemetery", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
    boundaries: [cemeteryId, otherId].map((id) => ({ type: "Feature", properties: { id, name: id }, geometry })),
    sections: [],
    graves: [cemeteryId, otherId].map((id) => ({ ...summaries[0], cemeteryId: id, displayLabel: "MATCH-GRAVE" })),
    lots: [cemeteryId, otherId].map((id) => ({ id: "1", cemeteryId: id, section: "A", name: "MATCH-LOT", geometry })),
    headstones: [cemeteryId, otherId].map((id) => ({ ...markerSummary, id: `marker-${id}`, cemeteryId: id, headstoneId: "MATCH-MARKER" })),
  } }));
  await page.route("**/api/search**", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/");
  await page.getByLabel("Search cemetery records").fill("MATCH");
  await expect(page.getByText("Search is unavailable. Showing matches from loaded map data.")).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(6);
  for (const id of [cemeteryId, otherId]) {
    await page.getByRole("combobox", { name: "Cemetery", exact: true }).selectOption(id);
    await expect(page.locator(".result-card")).toHaveCount(3);
    await expect(page.locator(".result-card").filter({ hasText: "MATCH-GRAVE" })).toHaveCount(1);
    await expect(page.locator(".result-card").filter({ hasText: "MATCH-LOT" })).toHaveCount(1);
    await expect(page.locator(".result-card").filter({ hasText: "MATCH-MARKER" })).toHaveCount(1);
  }
});

test("an empty remote result stays empty and a failed new query restores fallback", async ({ page }) => {
  await fixture(page);
  let fail = false;
  await page.route("**/api/search**", (route) => route.fulfill(fail ? { status: 503, json: {} } : { json: [] }));
  await page.goto("/");
  await page.getByLabel("Search cemetery records").fill("A-TEST");
  await expect(page.getByText("Searching records…", { exact: true })).toBeHidden();
  await expect(page.locator(".result-card")).toHaveCount(0);
  fail = true;
  await page.getByLabel("Search cemetery records").fill("A-A-TEST");
  await expect(page.getByText("Search is unavailable. Showing matches from loaded map data.")).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(1);
});
