import { expect, test } from "@playwright/test";
import type { CemeteryData } from "../src/types";

declare global { interface Window { scopedCollections: { data: CemeteryData; update: () => void }; previousScopedCollections: CemeteryData } }

test("editing a marker preserves every unrelated scoped collection", async ({ page }) => {
  await page.goto("/tests/scoped-collections.html");
  await expect.poll(() => page.evaluate(() => Boolean(window.scopedCollections))).toBe(true);
  await page.evaluate(() => {
    window.previousScopedCollections = window.scopedCollections.data;
    window.scopedCollections.update();
  });
  await expect.poll(() => page.evaluate(() => window.scopedCollections.data.headstones[0].label)).toBe("Updated");
  expect(await page.evaluate(() => {
    const before = window.previousScopedCollections, after = window.scopedCollections.data;
    return Object.fromEntries((["boundaries", "sections", "graves", "lots", "lotRestrictedAreas", "headstones"] as const)
      .map((key) => [key, before[key] === after[key]]));
  })).toEqual({ boundaries: true, sections: true, graves: true, lots: true, lotRestrictedAreas: true, headstones: false });
});
