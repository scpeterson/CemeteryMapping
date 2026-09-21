import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, select } from "./fixtures/cemetery";
import type { Map, GeoJSONSource } from "maplibre-gl";

declare global { interface Window { mapHighlightTest: { map: Map; calls: Record<string, number> } } }

test("selection and search highlight stable features without resubmitting geometry", async ({ page }) => {
  await fixture(page);
  await page.goto("/tests/map-highlighting.html");
  await expect.poll(() => page.evaluate(() => Boolean(window.mapHighlightTest?.map.getSource("graves")))).toBe(true);
  await select(page, "A-TEST");
  const key = `${cemeteryId}:A-TEST`;
  await expect.poll(() => page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).selected, key)).toBe(true);
  const before = await page.evaluate(() => ({ ...window.mapHighlightTest.calls }));
  await select(page, "B-TEST");
  await expect.poll(() => page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).selected, key)).toBe(false);
  await expect.poll(() => page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).selected, `${cemeteryId}:B-TEST`)).toBe(true);
  await page.getByLabel("Search cemetery records").fill("");
  await expect.poll(() => page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).searchMatch, key)).toBe(false);
  expect(await page.evaluate(() => ({ ...window.mapHighlightTest.calls }))).toEqual(before);
  await page.getByRole("button", { name: /^Diagram view:/ }).click();
  expect(await page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).selected, `${cemeteryId}:B-TEST`)).toBe(true);
  await page.evaluate(async () => {
    const source = window.mapHighlightTest.map.getSource("graves") as GeoJSONSource;
    await source.setData(await source.getData());
  });
  expect(await page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).selected, `${cemeteryId}:B-TEST`)).toBe(true);
  const paint = await page.evaluate(() => window.mapHighlightTest.map.getPaintProperty("graves-line", "line-color"));
  expect(JSON.stringify(paint)).toContain('"feature-state"');
});
