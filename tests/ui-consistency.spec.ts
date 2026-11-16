import { expect, test } from "@playwright/test";
import { fixture, showApplicationActions } from "./fixtures/cemetery";

for (const width of [390, 1280]) {
  test(`administration keeps binary controls square and multiline typography consistent at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/admin/**", route => {
      const path = new URL(route.request().url()).pathname;
      const json = path.endsWith("/cemetery-records") ? { cemeteries: [], sections: [], lots: [] }
        : path.endsWith("/access-request-stats") ? { pending: 0, lastHour: 0, limits: { pending: 100, hourly: 100 } } : [];
      return route.fulfill({ json });
    });
    await fixture(page);
    await page.route("**/api/admin/lookups", route => route.fulfill({ json: {
      tables: [{ table: "marker_material_types", label: "Marker materials", hasSourceFields: false }],
      lookups: { marker_material_types: [] },
    } }));
    await page.goto("/");
    await showApplicationActions(page);
    await page.getByRole("button", { name: /^Open administration:/ }).click();
    const admin = page.getByRole("dialog", { name: "Admin management" });
    await admin.getByRole("button", { name: "Users", exact: true }).click();
    const active = admin.getByRole("checkbox", { name: "Active user", exact: true });
    await expect(active).toBeVisible();
    const box = await active.boundingBox();
    expect(box?.width).toBe(16);
    expect(box?.height).toBe(16);
    await active.uncheck();
    await expect(active).not.toBeChecked();
    // Restore the baseline before navigating; this review never submits a write.
    await active.check();
    await admin.getByRole("button", { name: "Lookups", exact: true }).click();
    const row = admin.locator(".lookup-row-new");
    const label = row.getByRole("textbox", { name: "Label", exact: true });
    const description = row.getByRole("textbox", { name: "Description", exact: true });
    await expect(description).toBeVisible();
    const font = await label.evaluate(el => getComputedStyle(el).fontFamily);
    await expect(description).toHaveCSS("font-family", font);
    await expect(description).toHaveCSS("border-radius", "7px");
    const checkbox = row.getByRole("checkbox", { name: "Active", exact: true });
    const lookupBox = await checkbox.boundingBox();
    expect(lookupBox?.width).toBe(16);
    expect(lookupBox?.height).toBe(16);
    const alignment = await checkbox.evaluate(el => {
      const input = el.getBoundingClientRect(), parent = el.closest("label")!.getBoundingClientRect();
      return { inputLeft: input.left, labelLeft: parent.left, display: getComputedStyle(el.closest("label")!).display };
    });
    expect(alignment.display).toBe("flex");
    expect(Math.abs(alignment.inputLeft - alignment.labelLeft)).toBeLessThan(2);
    await label.focus();
    await page.keyboard.press("Tab");
    await expect(description).toBeFocused();
    await expect(description).toHaveCSS("outline-style", "solid");
    await expect(description).toHaveCSS("outline-width", "3px");
    expect(await admin.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`lookup-controls-${width}.png`) });
  });

  test(`control-point tools retain compact controls and fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto("/");
    await showApplicationActions(page);
    await page.getByRole("button", { name: /^Open control point collector:/ }).click();
    const dialog = page.getByRole("dialog", { name: "Control point collector", exact: true });
    await expect(dialog).toBeVisible();
    const control = dialog.locator(".control-point-field select").first();
    await expect(control).toHaveCSS("border-radius", "7px");
    await expect(control).toHaveCSS("min-height", "36px");
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`control-points-${width}.png`) });
  });

}

for (const width of [320, 390, 1280]) {
  test(`standalone pages share control styling without horizontal clipping at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/^http:\/\/[^/]+\/api\//, route => route.fulfill({ status: 404, json: { error: "Outside UI fixture" } }));
    await fixture(page);
    await page.route("https://challenges.cloudflare.com/**", route => route.abort());
    await page.route("**/api/export-cemeteries?**", route => route.fulfill({ json: [] }));
    for (const path of ["/request-access/", "/field/", "/exports/"]) {
      await page.goto(path);
      const form = page.locator("main");
      const controls = form.locator('input:not([type="hidden"], [tabindex="-1"]):visible, select:visible, textarea:visible');
      await expect(controls.first()).toBeVisible();
      const styles = await controls.evaluateAll(elements => elements.map(el => {
        const css = getComputedStyle(el), rect = el.getBoundingClientRect();
        return { radius: css.borderRadius, font: css.fontFamily, border: css.borderTopStyle,
          left: rect.left, right: rect.right, height: rect.height };
      }));
      for (const style of styles) {
        expect(style.radius).toBe("7px");
        expect(style.border).toBe("solid");
        expect(style.font).toContain("Inter");
        expect(style.height).toBeGreaterThanOrEqual(38);
        expect(style.left).toBeGreaterThanOrEqual(0);
        expect(style.right).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`${path.split("/")[1]}-${width}.png`), fullPage: true });
    }
  });
}
