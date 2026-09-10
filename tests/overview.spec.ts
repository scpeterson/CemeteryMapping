import { expect, test } from "@playwright/test";
import { cemeteryId, detail, fixture, gravePath, select } from "./fixtures/cemetery";
import { marker, overviewFixture, overviewGrave } from "./fixtures/overview";

const overview = (page: import("@playwright/test").Page) => page.getByRole("tabpanel", { name: "Overview", exact: true });

test("gravesite Overview shows newest photo, people and owners without editing controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await overviewFixture(page);
  let token = "";
  await page.route("**/media/latest-marker.png", async (route) => {
    token = route.request().headers().authorization;
    await route.fallback();
  });
  await page.goto("/tests/auth.html");
  await select(page, "A-TEST");
  const panel = overview(page);
  await expect(panel).toContainText("Alice Example");
  await expect(panel).toContainText("Owner A-TEST");
  await expect(panel).toContainText("Occupied");
  await expect(panel).toContainText("Photo of linked marker HS-OVERVIEW");
  await expect(panel.getByRole("img", { name: "latest-marker" })).toBeVisible();
  expect(token).toBe("Bearer fixture-token");
  await expect(panel.locator("input, select, textarea")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /Edit|Save|Delete|Upload/ })).toHaveCount(0);
  await panel.getByRole("button", { name: "Open latest photo" }).click();
  await expect(page.getByRole("dialog", { name: "Latest feature photo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel.getByRole("button", { name: "Open latest photo" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("grave-overview.png"), fullPage: true });
  await panel.getByRole("button", { name: "View burial records" }).click();
  await expect(page.getByRole("tab", { name: "People and ownership" })).toHaveAttribute("aria-selected", "true");
  await select(page, "A-TEST");
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Location and geometry" }).click();
  await expect(page.getByRole("button", { name: /Edit gravesite/ })).toBeVisible();
  await select(page, "B-TEST");
  await expect(overview(page)).toContainText("Bob Example");
  await expect(overview(page)).not.toContainText("Alice Example");
});

test("marker Overview groups linked people and owners and defaults after reselection", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await overviewFixture(page);
  await page.goto("/");
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  const panel = overview(page);
  await expect(panel).toContainText("Alice Example");
  await expect(panel).toContainText("Bob Example");
  await expect(panel).not.toContainText("Unrelated Burial");
  await expect(panel).toContainText("Owner A-TEST");
  await expect(panel).toContainText("Owner B-TEST");
  await expect(panel).toContainText("Owners of linked gravesites");
  await expect(panel.getByRole("img", { name: "latest-marker" })).toBeVisible();
  await expect(panel.locator("input, select, textarea")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit marker HS-OVERVIEW" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("marker-overview.png"), fullPage: true });
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit marker HS-OVERVIEW" })).toBeVisible();
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await panel.getByRole("region", { name: "Linked gravesites" }).getByRole("button", { name: "A-B-TEST", exact: true }).click();
  await expect(overview(page)).toContainText("Bob Example");
});

test("read-only users cannot see owners in either overview", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "reader", assignedCemeteryIds: [cemeteryId], permissions: {} } }));
  await page.goto("/");
  await select(page, "A-TEST");
  await expect(overview(page)).toContainText("Alice Example");
  await expect(overview(page)).not.toContainText("Owner A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(overview(page)).toContainText("Bob Example");
  await expect(overview(page)).not.toContainText("Owner B-TEST");
});

test("missing photos and people have explicit empty states on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await fixture(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Search", exact: true }).click();
  await select(page, "A-TEST");
  await expect(overview(page)).toContainText("No photo available.");
  await expect(overview(page)).toContainText("No burial recorded.");
  await expect(overview(page)).toContainText("No current ownership is recorded.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("failed linked records can retry without showing stale people after selection", async ({ page }) => {
  await overviewFixture(page);
  let fail = true;
  await page.route(gravePath("B-TEST"), (route) => fail ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.fulfill({ json: overviewGrave("B-TEST") }));
  await page.goto("/");
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(overview(page)).toContainText("Some linked gravesite details could not be loaded.");
  fail = false;
  await overview(page).getByRole("button", { name: "Retry linked records" }).click();
  await expect(overview(page)).toContainText("Bob Example");
  await page.route(gravePath("B-TEST"), (route) => route.fulfill({ json: detail("B-TEST") }));
  await select(page, "B-TEST");
  await expect(overview(page)).toContainText("No burial recorded.");
  await expect(overview(page)).not.toContainText("Alice Example");
});

test("legacy marker photo is used when there are no linked photo assets", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: { ...marker, mediaAssets: [], photoUrl: "/media/legacy.png" } }));
  await page.goto("/");
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(overview(page).getByRole("img", { name: "Marker HS-OVERVIEW" })).toBeVisible();
});
