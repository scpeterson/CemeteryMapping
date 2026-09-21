import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, select, geometry, summaries } from "./fixtures/cemetery";
import { marker, markerSummary, overviewFixture } from "./fixtures/overview";
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

for (const kind of ["graves", "lots", "markers"] as const) {
  test(`map clicks select and highlight rendered ${kind}`, async ({ page }) => {
    await overviewFixture(page);
    const lot = { id: "LOT-TEST", cemeteryId, name: "Test lot", section: "A", geometry };
    await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
      boundaries: [{ type: "Feature", properties: { name: "Test Cemetery" }, geometry }],
      sections: [], lots: [lot], graves: [summaries[0]],
      headstones: [{ ...markerSummary, id: "marker-neighbor", geometry: { type: "Point", coordinates: [-80.0004, 40.0005] } }, { ...markerSummary, graveKey: `${cemeteryId}:A-TEST`, geometry: { type: "Point", coordinates: [-80.0005, 40.0005] } }],
    } }));
    await page.goto("/tests/map-highlighting.html");
    const source = kind === "markers" ? "headstones" : kind;
    const layer = kind === "markers" ? "headstones-circle" : `${kind}-fill`;
    const id = kind === "markers" ? marker.id : kind === "lots" ? `${cemeteryId}:A::LOT-TEST` : `${cemeteryId}:A-TEST`;
    await expect.poll(() => page.evaluate((layer) => {
      const map = window.mapHighlightTest?.map;
      return map?.getLayer(layer) ? map.queryRenderedFeatures({ layers: [layer] }).length : 0;
    }, layer)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.isMoving())).toBe(false);
    await page.getByRole("button", { name: new RegExp(`^Select ${kind === "graves" ? "gravesites" : kind}:`) }).click();
    const point = await page.evaluate(() => {
      const map = window.mapHighlightTest.map;
      const p = map.project([-80.0005, 40.0005]);
      const rect = map.getCanvas().getBoundingClientRect();
      return { x: rect.left + p.x, y: rect.top + p.y };
    });
    await page.mouse.click(point.x, point.y);
    await expect(page.locator(".detail-panel")).toContainText(kind === "markers" ? marker.headstoneId : kind === "lots" ? "Test lot" : "Record ID: A-TEST");
    // Query the tiled, rendered feature: getFeatureState alone does not prove
    // that the renderer can associate stored state with the feature's ID.
    await expect.poll(() => page.evaluate(({ layer, id }) => window.mapHighlightTest.map
      .queryRenderedFeatures({ layers: [layer] }).some((feature) => feature.id === id && feature.state.selected === true), { layer, id })).toBe(true);
    await page.getByRole("button", { name: /^Diagram view:/ }).click();
    await page.evaluate(async (sourceId) => {
      const source = window.mapHighlightTest.map.getSource(sourceId) as GeoJSONSource;
      await source.setData(await source.getData());
    }, source);
    await expect.poll(() => page.evaluate(({ layer, id }) => window.mapHighlightTest.map
      .queryRenderedFeatures({ layers: [layer] }).some((feature) => feature.id === id && feature.state.selected === true), { layer, id })).toBe(true);
    if (kind === "markers") {
      const neighbor = await page.evaluate(() => window.mapHighlightTest.map.queryRenderedFeatures({ layers: ["headstones-circle"] })
        .find((feature) => feature.id === "marker-neighbor"));
      expect(neighbor).toBeDefined();
      expect(neighbor?.state.selected).not.toBe(true);
    }
  });
}
