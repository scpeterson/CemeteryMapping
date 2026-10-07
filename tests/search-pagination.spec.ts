import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, summaries } from "./fixtures/cemetery";
const graves = Array.from({ length: 125 }, (_, index) => ({ ...summaries[0], id: `PAGE-${String(index).padStart(3, "0")}`, space: String(index) }));
test("loaded map results mount only 50 cards and reset pagination on filtering", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: { boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry }], sections: [], lots: [], graves, headstones: [] } }));
  await page.goto("/");
  await expect(page.locator(".result-card")).toHaveCount(50);
  await page.getByRole("button", { name: "Next results" }).click();
  await expect(page.locator(".result-card").first()).toContainText("50");
  await expect(page.locator(".result-card")).toHaveCount(50);
  await page.getByRole("button", { name: "Next results" }).click();
  await expect(page.locator(".result-card")).toHaveCount(25);
  await expect(page.getByRole("button", { name: "Next results" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous results" }).click();
  await expect(page.locator(".result-card")).toHaveCount(50);
  await page.getByRole("button", { name: "Occupied", exact: true }).click();
  await expect(page.getByRole("button", { name: "Previous results" })).toBeDisabled();
});
test("remote pages request cemetery scope, load on demand and discard prior query pages", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: { boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry }], sections: [], lots: [], graves: summaries, headstones: [] } }));
  const offsets: number[] = [];
  await page.route("**/api/search**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("cemeteryId")).toBe(cemeteryId);
    const offset = Number(params.get("offset")); offsets.push(offset);
    return route.fulfill({ headers: { "X-Search-Has-More": String(offset < 100) }, json: graves.slice(offset, offset + 50).map((grave) => ({ grave, reasons: [params.get("q")] })) });
  });
  await page.goto("/");
  // Select the cemetery using the application scope picker.
  await page.getByRole("combobox", { name: "Cemetery", exact: true }).selectOption(cemeteryId);
  await page.getByLabel("Search cemetery records").fill("First query");
  await expect(page.locator(".result-card")).toHaveCount(50);
  await expect(page.locator(".results-heading")).toContainText("more available");
  expect(offsets).toEqual([0]);
  await page.getByRole("button", { name: "Next results" }).click();
  await expect(page.locator(".result-card").first()).toContainText("50");
  expect(offsets).toEqual([0, 50]);
  await page.getByLabel("Search cemetery records").fill("Second query");
  await expect(page.locator(".result-card").first()).toContainText("Second query");
  await expect(page.locator(".result-card").first()).toContainText("0");
  expect(offsets).toEqual([0, 50, 0]);
});
