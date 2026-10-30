import { expect, test } from "@playwright/test";
import { overviewFixture } from "./fixtures/overview";

test("opening a shared marker uses one overview request and no full grave requests", async ({ page }) => {
  await overviewFixture(page);
  const summaries: string[] = [], details: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/headstones/marker-1/overview")) summaries.push(request.url());
    if (request.url().includes("/grave-spaces/")) details.push(request.url());
  });
  await page.goto("/");
  await page.getByLabel("Search cemetery records").fill("HS-OVERVIEW");
  await page.locator(".result-card").filter({ hasText: "Monument ID:" }).click();
  const overview = page.getByRole("tabpanel", { name: "Overview", exact: true });
  await expect(overview).toContainText("Alice Example");
  await expect(overview).toContainText("Bob Example");
  expect(summaries).toHaveLength(1);
  expect(details).toHaveLength(0);
});
