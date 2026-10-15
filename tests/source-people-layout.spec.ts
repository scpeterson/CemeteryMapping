import { expect, test } from "@playwright/test";
import { fixture, cemeteryId } from "./fixtures/cemetery";

test("Source People editor stays inside Admin across window widths", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/admin/source-person-records**", route => route.fulfill({ json: {
    cemeteries: [{ id: cemeteryId, name: "Trinity Lutheran Church Cemetery" }], records: [],
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Source People", exact: true }).click();
  const editor = admin.locator(".source-person-editor");
  await expect(editor.getByRole("heading", { name: "New source-only person" })).toBeVisible();
  for (const width of [1600, 1280, 1100, 900, 600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => admin.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect.poll(() => editor.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const bounds = await admin.boundingBox();
    for (const control of await editor.locator("input, select, textarea, button").all()) {
      const box = await control.boundingBox();
      if (box) expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    }
  }
});
