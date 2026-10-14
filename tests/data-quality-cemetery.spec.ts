import { expect, test } from "@playwright/test";
import { fixture, cemeteryId } from "./fixtures/cemetery";

test("Quality filters counts by cemetery and preserves selection on refresh", async ({ page }) => {
  await fixture(page);
  const second = "22222222-2222-4222-8222-222222222222";
  const requested: string[] = [];
  await page.route("**/api/admin/data-quality-dashboard**", route => {
    const selected = new URL(route.request().url()).searchParams.get("cemeteryId") ?? "";
    requested.push(selected);
    return route.fulfill({ json: {
      generatedAt: "2026-10-14T12:00:00Z", scope: "all", selectedCemeteryId: selected,
      cemeteries: [{ id: cemeteryId, name: "Alpha Cemetery" }, { id: second, name: "Beta Cemetery" }],
      totalOpenItems: selected ? 3 : 8,
      metrics: [{ id: "burials_review_needed", label: "Burials needing data review", description: "Review", count: selected ? 3 : 8, severity: "high", category: "Burials" }],
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Quality", exact: true }).click();
  const cemetery = admin.getByRole("combobox", { name: "Cemetery", exact: true });
  await expect(cemetery.locator("option")).toHaveCount(3);
  await expect(admin.locator(".data-quality-overview strong").first()).toHaveText("8");
  await cemetery.selectOption(second);
  await expect(admin.locator(".data-quality-overview strong").first()).toHaveText("3");
  await expect(admin.locator(".data-quality-overview")).toContainText("Beta Cemetery");
  await admin.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => requested.filter(id => id === second).length).toBe(2);
  await cemetery.selectOption("");
  await expect(admin.locator(".data-quality-overview strong").first()).toHaveText("8");
});
