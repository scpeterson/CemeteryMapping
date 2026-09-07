import { expect, test } from "@playwright/test";
import { fixture, select } from "./fixtures/cemetery";

test("keyboard users can select a result and operate detail tabs", async ({ page }) => {
  await fixture(page);
  await page.goto("/");
  await select(page, "A-TEST");
  await expect(page.locator('.result-card[aria-current="true"]')).toContainText("A-TEST");
  const overview = page.getByRole("tab", { name: "Overview", exact: true });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { selected: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute("aria-selected", "true");
});

test("nested confirmations close independently and restore focus", async ({ page }) => {
  await fixture(page);
  await page.goto("/");
  await page.evaluate(async () => { const harness = await import("/tests/uiHarness.tsx"); harness.mountConfirmationHarness(); });
  await page.getByRole("button", { name: "Open test editor" }).click();
  const outer = page.getByRole("dialog", { name: "Test editor", exact: true });
  await page.getByRole("button", { name: "Request removal" }).click();
  const inner = page.getByRole("dialog", { name: "Confirm change", exact: true });
  await expect(inner.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(inner).toHaveCount(0);
  await expect(outer).toBeVisible();
  await expect(outer).toContainText("Canceled");
  await expect(page.getByRole("button", { name: "Request removal" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(outer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open test editor" })).toBeFocused();
});

test("administration review views render their extracted filters and editors", async ({ page }) => {
  await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Deeds", exact: true }).click();
  await expect(admin.getByRole("heading", { name: "Deed Evidence", exact: true })).toBeVisible();
  await expect(admin.getByLabel("Case search", { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: "New case", exact: true }).click();
  await expect(admin.locator(".deed-case-form")).toBeVisible();
  await admin.getByRole("button", { name: "Readings", exact: true }).click();
  await expect(admin.locator(".deed-review-filter-form")).toBeVisible();
  await expect(admin.locator(".deed-entry-list")).toBeVisible();
});

for (const width of [390, 768, 1280]) {
  test(`workspace has no horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Open reports:/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`workspace-${width}.png`), fullPage: true });
    if (width < 761) await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Search", exact: true }).click();
    await select(page, "A-TEST");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`details-${width}.png`), fullPage: true });
  });
}

test("switching administration users cannot silently replace a draft", async ({ page }) => {
  await fixture(page);
  const users = ["First", "Second"].map((displayName, index) => ({ id: String(index + 1), displayName, email: `${displayName.toLowerCase()}@example.test`, externalSubject: `test|${index}`, role: "admin", assignedCemeteryIds: [], isActive: true }));
  await page.route("**/api/admin/users", (route) => route.fulfill({ json: users }));
  await page.route("**/api/admin/roles", (route) => route.fulfill({ json: [{ name: "admin", description: "Administrator", userCount: 2 }] }));
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Users", exact: true }).click();
  await admin.locator(".admin-user-edit").filter({ hasText: "First" }).click();
  const name = admin.getByLabel("Display name", { exact: true });
  await name.fill("Draft first user");
  page.once("dialog", (dialog) => dialog.dismiss());
  await admin.locator(".admin-user-edit").filter({ hasText: "Second" }).click();
  await expect(name).toHaveValue("Draft first user");
  page.once("dialog", (dialog) => dialog.accept());
  await admin.locator(".admin-user-edit").filter({ hasText: "Second" }).click();
  await expect(name).toHaveValue("Second");
});
