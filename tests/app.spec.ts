import { expect, test } from "@playwright/test";

test("loads API-backed cemetery records and supports search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
  await expect(page.getByText("9 results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "A-01-01" })).toBeVisible();

  await page.getByLabel("Search cemetery records").fill("Garcia");
  await expect(page.getByText("2 results")).toBeVisible();
  await expect(page.getByText("Owner: Garcia Family").first()).toBeVisible();

  const response = await page.request.get("/api/search?q=Garcia");
  expect(response.ok()).toBe(true);
  const matches = (await response.json()) as unknown[];
  expect(matches).toHaveLength(2);
});
