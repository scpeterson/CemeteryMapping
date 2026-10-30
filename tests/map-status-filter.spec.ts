import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, summaries } from "./fixtures/cemetery";
import { markerSummary } from "./fixtures/overview";
import type { Map } from "maplibre-gl";

declare global { interface Window { mapHighlightTest: { map: Map; calls: Record<string, number> } } }

test("status toggles hide graves and veteran stars without resubmitting geometry or losing selection", async ({ page }) => {
  await fixture(page);
  const key = `${cemeteryId}:A-TEST`;
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
    boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry }],
    sections: [], lots: [], graves: [{ ...summaries[0], hasVeteran: true }],
    headstones: [{ ...markerSummary, graveKey: key }],
  } }));
  await page.goto("/tests/map-highlighting.html");
  const renderedGraves = () => page.evaluate(() => {
    const map = window.mapHighlightTest?.map;
    return map?.getLayer("graves-fill") ? map.queryRenderedFeatures({ layers: ["graves-fill"] }).length : 0;
  });
  await expect.poll(renderedGraves).toBeGreaterThan(0);
  await page.locator(".result-card").first().click();
  await expect.poll(() => page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).selected, key)).toBe(true);
  const before = await page.evaluate(() => ({ ...window.mapHighlightTest.calls }));
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await expect.poll(renderedGraves).toBe(0);
  const hiddenFilters = await page.evaluate(() => {
    const map = window.mapHighlightTest.map;
    return ["graves-fill", "graves-line", "grave-labels", "veteran-grave-symbols", "headstones-veteran-star"].map((layer) => map.getFilter(layer));
  });
  for (const filter of hiddenFilters.slice(0, 4)) expect(JSON.stringify(filter)).not.toContain('"available"');
  expect(hiddenFilters[4]).toEqual(["all", ["==", ["get", "hasVeteran"], true], ["in", ["get", "graveKey"], ["literal", []]]]);
  // Markers remain selectable even when their associated grave's status is hidden.
  await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.queryRenderedFeatures({ layers: ["headstones-circle"] }).length)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await expect.poll(renderedGraves).toBeGreaterThan(0);
  expect(await page.evaluate((id) => window.mapHighlightTest.map.getFeatureState({ source: "graves", id }).selected, key)).toBe(true);
  const after = await page.evaluate(() => ({ ...window.mapHighlightTest.calls }));
  console.log("Status-toggle source submissions:", { graves: (after.graves ?? 0) - (before.graves ?? 0), headstones: (after.headstones ?? 0) - (before.headstones ?? 0) });
  expect(after).toEqual(before);
  expect(await page.evaluate(() => window.mapHighlightTest.map.getFilter("headstones-veteran-star"))).toEqual(["all", ["==", ["get", "hasVeteran"], true], ["in", ["get", "graveKey"], ["literal", [key]]]]);
});
