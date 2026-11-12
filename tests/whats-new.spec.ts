import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fixture, showApplicationActions } from "./fixtures/cemetery";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const releases = JSON.parse(readFileSync("src/data/releaseNotes.json", "utf8"));

for (const role of ["reader", "power-user", "cemetery-admin", "admin"]) {
  test(`${role} can read installed-release notes and keeps the hover details`, async ({ page }) => {
    await fixture(page);
    await page.route("**/api/me", (route) => route.fulfill({ json: { role, assignedCemeteryIds: [], permissions: { canOpenAdminPanel: role === "admin" } } }));
    await page.goto("/tests/auth.html");
    const badge = page.getByRole("banner").getByRole("button", { name: /What's new/ });
    await expect(badge).toBeVisible();
    const title = (await badge.getAttribute("title"))!;
    expect(title).toContain(`Version: ${version} (`);
    expect(title).toContain("Build:");
    expect(title).toContain("API: /api");
    await badge.hover();
    await expect(badge).toHaveAttribute("title", title);
    const writes: string[] = [];
    page.on("request", (request) => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()); });
    await badge.click();
    const panel = page.getByRole("dialog", { name: "What's new", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: `What's new in v${version}`, exact: true })).toBeVisible();
    await expect(panel.locator("li")).toHaveText(releases[version]);
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(badge).toBeFocused();
    await badge.hover();
    await expect(badge).toHaveAttribute("title", title);
    expect(writes).toEqual([]);
  });
}

test("keyboard opening, focus containment and Escape preserve the mobile menu", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await fixture(page);
  await page.goto("/tests/auth.html");
  await showApplicationActions(page);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const badge = page.getByRole("banner").getByRole("button", { name: /What's new/ });
  for (const key of ["Enter", "Space"]) {
    await badge.focus();
    await page.keyboard.press(key);
    const panel = page.getByRole("dialog", { name: "What's new", exact: true });
    const close = panel.getByRole("button", { name: "Close", exact: true });
    await expect(panel).toBeVisible();
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.height).toBeLessThanOrEqual(720);
    await page.screenshot({ path: testInfo.outputPath(`whats-new-${key}.png`) });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(badge).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
  }
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});

test("an unknown installed version never displays another release's notes", async ({ page }) => {
  await fixture(page);
  await page.goto("/tests/auth.html");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.evaluate(async () => {
    const harness = await import("/tests/mountUiHarness.ts");
    harness.mountWhatsNewHarness("99.0.0");
  });
  await page.getByRole("button", { name: "Open release notes fixture" }).click();
  const panel = page.getByRole("dialog", { name: "What's new", exact: true });
  await expect(panel).toContainText("v99.0.0");
  await expect(panel).toContainText("No notes for this version.");
  await expect(panel.getByRole("list")).toHaveCount(0);
  await expect(panel.locator("time")).toHaveCount(0);
  await expect(panel).not.toContainText(releases[version][0]);
});
