import { expect, test } from "@playwright/test";
import { fixture, select } from "./fixtures/cemetery";

for (const width of [390, 768, 1280, 1920]) {
  test(`signed-in controls do not overlap the workspace at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.route("**/api/reports", (route) => route.fulfill({ json: [] }));
    await page.goto("/tests/auth.html");
    const account = page.locator(".auth-session");
    const signOut = account.getByRole("button", { name: "Sign out", exact: true });
    await expect(signOut).toBeVisible();
    const accountBox = (await account.boundingBox())!;
    for (const button of await page.locator(".map-toolbar button, .map-controls button, .mobile-workspace-nav button:visible").all()) {
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(accountBox.y + accountBox.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const signOutBox = (await signOut.boundingBox())!;
    expect(signOutBox.x + signOutBox.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: /^Open reports:/ }).click();
    await expect(page.getByRole("dialog", { name: "Reports", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Open reports:/ })).toBeFocused();
    if (width <= 760) {
      await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Search", exact: true }).click();
      await select(page, "A-TEST");
      await expect(signOut).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`authenticated-${width}.png`), fullPage: true });
    await signOut.click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(signOut).toBeVisible();
  });
}

test("signing out checks unsaved edits and supports the fallback identity label", async ({ page }) => {
  await fixture(page);
  await page.goto("/tests/auth.html?identity=");
  await expect(page.locator(".auth-session")).toContainText("Signed in");
  await select(page, "A-TEST");
  await page.getByRole("button", { name: /Edit gravesite/ }).click();
  const name = page.locator(".grave-form").getByLabel("Name", { exact: true });
  await name.fill("Retain my draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(name).toHaveValue("Retain my draft");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("signed-in reports remain printable without account controls", async ({ page }) => {
  await fixture(page);
  const report = { id: "print", title: "Marker pages", category: "Markers", requiredRole: "reader", parameters: [], examples: [], description: "Print fixture" };
  await page.route("**/api/reports", (route) => route.fulfill({ json: [report] }));
  await page.route("**/api/reports/run", (route) => route.fulfill({ json: {
    report, layout: "marker-burial-pages", generatedAt: "2026-09-07T12:00:00Z", columns: [], notes: [],
    rows: [{ marker_id: "PRINT-MARKER", marker_uuid: "print-marker", burial_uuid: "print-burial" }],
  } }));
  await page.goto("/tests/auth.html");
  await page.getByRole("button", { name: /^Open reports:/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const heading = page.getByRole("heading", { name: "PRINT-MARKER", exact: true });
  await expect(heading).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(heading).toBeVisible();
  await expect(page.locator(".auth-session")).toBeHidden();
});
