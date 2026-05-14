import { expect, test } from "@playwright/test";

test("searches and opens a grave record", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
  await page.getByLabel("Search cemetery records").fill("Garcia");
  await expect(page.getByRole("button", { name: /Section B, Lot 01, Space 01/ })).toBeVisible();
  await page.getByRole("button", { name: /Section B, Lot 01, Space 01/ }).click();
  await expect(page.getByRole("heading", { name: "B-01-01" })).toBeVisible();
  await expect(page.locator(".detail-panel").getByText("Luis Garcia", { exact: true })).toBeVisible();
});
