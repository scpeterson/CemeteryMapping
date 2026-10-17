import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

test("Bulk tools keep headings, fields, and actions inside Admin", async ({ page }) => {
  await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Bulk", exact: true }).click();
  await expect(admin.locator(".bulk-tool-card")).toHaveCount(3);
  for (const width of [1600, 1280, 1100, 900, 600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => admin.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const card of await admin.locator(".bulk-tool-card").all()) {
      await expect.poll(() => card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const heading = await card.locator("h4").boundingBox();
      const field = await card.locator("textarea").boundingBox();
      expect(heading!.y + heading!.height).toBeLessThanOrEqual(field!.y);
    }
  }
  await page.setViewportSize({ width: 900, height: 600 });
  await admin.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const lastCard = admin.locator(".bulk-tool-card").last();
  await expect.poll(async () => {
    const panel = await admin.boundingBox();
    const card = await lastCard.boundingBox();
    return panel!.y + panel!.height - (card!.y + card!.height);
  }).toBeGreaterThanOrEqual(12);
  await admin.getByRole("button", { name: "Go to Readings", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Readings", exact: true })).toHaveClass(/is-active/);
});
