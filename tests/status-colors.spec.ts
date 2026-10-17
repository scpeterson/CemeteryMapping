import { expect, test } from "@playwright/test";
import { fixture, summaries } from "./fixtures/cemetery";

// Explicit expectations protect the domain palette from generic feedback tones.
const statuses = [
  ["available", "Available", "rgb(95, 168, 121)"],
  ["reserved", "Reserved", "rgb(217, 164, 65)"],
  ["occupied", "Occupied", "rgb(47, 111, 189)"],
  ["sold", "Sold", "rgb(142, 111, 187)"],
  ["needs_review", "Needs review", "rgb(199, 82, 79)"],
  ["unknown", "Unknown", "rgb(184, 192, 200)"],
] as const;

test("search badges retain all six cemetery status colors and labels", async ({ page }, testInfo) => {
  await fixture(page);
  await page.route("**/api/search**", (route) => route.fulfill({ json: statuses.map(([status]) => ({
    grave: { ...summaries[0], id: status, status }, reasons: [],
  })) }));
  await page.goto("/");
  await page.getByLabel("Search cemetery records").fill("status palette");
  await expect(page.locator(".result-card")).toHaveCount(6);
  for (const [status, label, color] of statuses) {
    const badge = page.locator(".result-card .ui-status-badge").filter({ hasText: new RegExp(`^${label}$`) });
    await expect(badge).toBeVisible();
    expect(await badge.evaluate((element) => getComputedStyle(element, "::before").backgroundColor)).toBe(color);
    const filter = page.getByRole("group", { name: "Filter by grave status" }).getByRole("button", { name: label, exact: true });
    await expect(filter.locator("span")).toHaveCSS("background-color", color);
    await expect(page.locator(`.map-legend .legend-${status}`)).toHaveCSS("background-color", color);
  }
  await page.screenshot({ path: testInfo.outputPath("status-palette.png"), fullPage: true });
});
