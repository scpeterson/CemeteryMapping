import { expect, test } from "@playwright/test";
import { fixture, showApplicationActions } from "./fixtures/cemetery";

for (const width of [320, 390, 760, 768, 1280, 1920]) {
  test(`application header fits and exposes actions at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto("/tests/auth.html");
    const header = page.getByRole("banner");
    await expect(header.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cemetery Map" })).toHaveCount(1);
    await expect(header).toContainText("1 cemetery");
    await expect(header.locator("#application-actions")).toBeAttached();
    const menu = header.getByRole("button", { name: "Menu", exact: true });
    if (width <= 760) {
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(header.getByRole("navigation", { name: "Application actions" })).toBeHidden();
    } else await expect(menu).toBeHidden();
    await showApplicationActions(page);
    const actions = header.locator("button:visible");
    await expect(header.getByRole("button", { name: /^Open reports:/ })).toBeVisible();
    const boxes = await actions.evaluateAll((elements) => elements.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }));
    for (const [index, box] of boxes.entries()) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      for (const other of boxes.slice(index + 1)) {
        expect(box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top).toBe(false);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`header-${width}.png`), fullPage: true });
    if (width <= 760) {
      await header.getByRole("button", { name: /^Open reports:/ }).focus();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
    }
  });
}

test("phone application dialogs open from Search and Details and restore focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await fixture(page);
  await page.route("**/api/reports", (route) => route.fulfill({ json: [] }));
  await page.goto("/tests/auth.html");
  for (const view of ["Search", "Details"]) {
    await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: view, exact: true }).click();
    await showApplicationActions(page);
    for (const [action, dialog] of [[/^Open reports:/, "Reports"], [/^Open administration:/, "Admin management"], [/^Open control point collector:/, "Control point collector"]] as const) {
      const opener = page.getByRole("button", { name: action });
      await opener.click();
      await expect(page.getByRole("dialog", { name: dialog, exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
    }
  }
});

test("readers see Reports without administrative header actions", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "reader", assignedCemeteryIds: [], permissions: { canOpenAdminPanel: false } } }));
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("button", { name: /^Open reports:/ })).toBeVisible();
  await expect(header.getByRole("button", { name: /^Open administration:/ })).toHaveCount(0);
  await expect(header.getByRole("button", { name: /^Open control point collector:/ })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});
