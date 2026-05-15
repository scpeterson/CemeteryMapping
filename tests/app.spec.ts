import { expect, test } from "@playwright/test";

test("loads the cemetery map shell without bundled demo data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
  await expect(page.getByText("0 results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Select a grave site" })).toBeVisible();
});
