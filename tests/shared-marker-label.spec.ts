import { expect, test } from "@playwright/test";
import { gravePath, select } from "./fixtures/cemetery";
import { marker, overviewFixture, overviewGrave } from "./fixtures/overview";

for (const relationshipType of ["primary", "spans"]) {
  test(`shared marker label appears for the ${relationshipType} gravesite`, async ({ page }) => {
    await overviewFixture(page);
    await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: {
      ...overviewGrave("A-TEST"),
      headstones: [{ ...marker, relationshipType, spansMultipleGravesites: true }],
    } }));
    await page.goto("/");
    await select(page, "A-TEST");
    await page.getByRole("tab", { name: "Monuments" }).click();
    await expect(page.locator(".marker-relationship")).toHaveText("Marker spans multiple gravesites");
    await expect(page.locator(".marker-relationship")).toHaveCount(1);
  });
}

test("a primary marker for one grave has no shared marker label", async ({ page }) => {
  await overviewFixture(page);
  await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: {
    ...overviewGrave("A-TEST"),
    headstones: [{ ...marker, spansMultipleGravesites: false }],
  } }));
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tab", { name: "Monuments" }).click();
  await expect(page.locator(".marker-relationship")).toHaveCount(0);
});
