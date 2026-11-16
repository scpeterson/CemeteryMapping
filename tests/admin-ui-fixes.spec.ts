import { expect, test, type Page } from "@playwright/test";
import { fixture, showApplicationActions } from "./fixtures/cemetery";

async function adminFixture(page: Page) {
  await page.route("**/api/admin/**", route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("/cemetery-records") ? { cemeteries: [], sections: [], lots: [] }
      : path.endsWith("/access-request-stats") ? { pending: 0, lastHour: 0, limits: { pending: 200, hourly: 100 } } : [] });
  });
  await fixture(page);
}
async function openAdmin(page: Page) {
  await page.goto("/");
  await showApplicationActions(page);
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  return page.getByRole("dialog", { name: "Admin management" });
}

for (const width of [390, 1280]) {
  test(`request refresh is styled, stays disabled while loading, and recovers from errors at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await adminFixture(page);
    let calls = 0;
    let pauseNext = false;
    let release: (() => void) | undefined;
    await page.route("**/api/admin/access-requests", async route => {
      expect(route.request().method()).toBe("GET");
      calls++;
      if (pauseNext) {
        pauseNext = false;
        await new Promise<void>(resolve => { release = resolve; });
        return route.fulfill({ status: 503, json: { error: "Request queue temporarily unavailable" } });
      }
      return route.fulfill({ json: [] });
    });
    const admin = await openAdmin(page);
    await admin.getByRole("button", { name: "Users", exact: true }).click();
    const refresh = admin.getByRole("button", { name: "Refresh requests", exact: true });
    await expect(refresh).toBeEnabled();
    await expect(refresh).toHaveCSS("min-height", "38px");
    await expect(refresh).toHaveCSS("border-radius", "7px");
    await expect(refresh).toHaveAttribute("type", "button");
    await refresh.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(refresh).toBeFocused();
    await expect(refresh).toHaveCSS("outline-width", "3px");
    const initialCalls = calls;
    pauseNext = true;
    await refresh.click();
    await expect.poll(() => calls).toBe(initialCalls + 1);
    await expect(refresh).toBeDisabled();
    await expect(refresh).toHaveAttribute("aria-busy", "true");
    release!();
    await expect(admin.getByRole("alert")).toHaveText("Something went wrong on the server. Please try again. If this continues, contact an administrator.");
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect.poll(() => calls).toBe(initialCalls + 2);
    await expect(admin).toContainText("No pending requests.");
    await expect(admin.getByRole("alert")).toHaveCount(0);
    await expect(refresh).toBeEnabled();
    await refresh.scrollIntoViewIfNeeded();
    expect(await admin.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`refresh-requests-${width}.png`) });
  });
}

const variants = [
  { table: "marker_material_types", label: "Plain materials", hasSourceFields: false },
  { table: "marker_types", label: "Marker types with sources", hasSourceFields: true },
  { table: "military_rank_types", label: "Military ranks", hasSourceFields: false, hasRankFields: true },
  { table: "grave_feature_subtypes", label: "Feature subtypes", hasSourceFields: false, hasGraveFeatureType: true },
];
for (const definition of variants) {
  test(`${definition.label} existing and new fields never overlap across the phone breakpoint`, async ({ page }, testInfo) => {
    await adminFixture(page);
    const branch = "11111111-1111-4111-8111-111111111111";
    const row = { id: "22222222-2222-4222-8222-222222222222", code: "fixture", label: "Example marker value",
      description: "A detailed explanation of this controlled value for cemetery administrators.",
      sourceNotes: "An independent source note that must remain readable and editable.", sourceUrl: "https://example.test/source/record",
      militaryBranchId: branch, abbreviation: "Example", payGrade: "Example grade", rankGroup: "enlisted", graveFeatureTypeId: branch,
      isActive: true, usageCount: 2, usageLabel: "records", createdAt: "", updatedAt: "" };
    await page.route("**/api/admin/lookups", route => route.fulfill({ json: {
      tables: [definition], lookups: { [definition.table]: [row],
        military_branch_types: [{ ...row, id: branch, label: "Army", code: "army" }],
        grave_feature_types: [{ ...row, id: branch, label: "Fixture feature" }] },
    } }));
    const admin = await openAdmin(page);
    await admin.getByRole("button", { name: "Lookups", exact: true }).click();
    await expect(admin.getByRole("combobox", { name: "Lookup table", exact: true })).toHaveValue(definition.table);
    const existing = admin.locator(".lookup-row-list .lookup-row").first();
    await expect(existing.getByRole("textbox", { name: "Label", exact: true })).toHaveValue(row.label);
    for (const width of [320, 390, 600, 800, 801, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const card of [existing, admin.locator(".lookup-row-new")]) {
        const geometry = await card.evaluate(el => {
          const outer = el.getBoundingClientRect();
          return { outer: { left: outer.left, right: outer.right },
            children: [...el.children].map(child => {
              const r = child.getBoundingClientRect();
              return { name: child.className || child.tagName, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            }).filter(r => r.right > r.left && r.bottom > r.top) };
        });
        for (const [i, current] of geometry.children.entries()) {
          expect(current.left, `${width}px ${current.name} stays inside its card`).toBeGreaterThanOrEqual(geometry.outer.left);
          expect(current.right, `${width}px ${current.name} stays inside its card`).toBeLessThanOrEqual(geometry.outer.right);
          if (width <= 800 && i) expect(current.top, `${width}px ${current.name} stacks below previous field`).toBeGreaterThanOrEqual(geometry.children[i - 1].bottom - 1);
          for (const previous of geometry.children.slice(0, i)) {
            const overlapX = Math.min(current.right, previous.right) - Math.max(current.left, previous.left);
            const overlapY = Math.min(current.bottom, previous.bottom) - Math.max(current.top, previous.top);
            expect(overlapX > 1 && overlapY > 1, `${width}px ${current.name} overlaps ${previous.name}`).toBe(false);
          }
        }
        if (width === 390 || width === 1280) {
          await card.scrollIntoViewIfNeeded();
          await card.screenshot({ path: testInfo.outputPath(`${definition.table}-${card === existing ? "existing" : "new"}-${width}.png`) });
        }
      }
      expect(await admin.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await expect(existing.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(row.description);
    if (definition.hasSourceFields) {
      await expect(existing.getByRole("textbox", { name: "Source notes", exact: true })).toHaveValue(row.sourceNotes);
      await expect(existing.getByRole("textbox", { name: "Source URL", exact: true })).toHaveValue(row.sourceUrl);
    }
  });
}
