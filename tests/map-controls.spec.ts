import { expect, test } from "@playwright/test";
import { fixture, select } from "./fixtures/cemetery";
import { overviewFixture, marker } from "./fixtures/overview";
import type { GeoJSONSource } from "maplibre-gl";

for (const width of [390, 1280]) {
  test(`measurement, zoom, fit and resize retain map behavior at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.route("https://imagery.pasda.psu.edu/**", route => route.abort());
    await page.route("https://gisdata.alleghenycounty.us/**", route => route.abort());
    await page.goto("/tests/map-highlighting.html");
    await expect.poll(() => page.evaluate(() => Boolean(window.mapHighlightTest?.map.getSource("measurement")))).toBe(true);
    await page.getByRole("button", { name: /^Diagram view:/ }).click();
    const scale = page.getByLabel("Map scale", { exact: true });
    await expect(scale).toContainText(/Scale 1:[\d,]+/);
    await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.isMoving())).toBe(false);
    const initialZoom = await page.evaluate(() => window.mapHighlightTest.map.getZoom());
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.getZoom())).toBeGreaterThan(initialZoom);
    await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.isMoving())).toBe(false);
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.getZoom())).toBeCloseTo(initialZoom, 1);
    await page.getByRole("button", { name: /^Fit (all cemetery data|selected cemetery)$/ }).click();
    await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.isMoving())).toBe(false);
    const sourceCounts = await page.evaluate(() => ({ ...window.mapHighlightTest.calls }));
    await page.getByRole("button", { name: "Measure distances between map points" }).click();
    await expect(page.locator(".map-measurement")).toContainText("Choose a starting point.");
    await expect(page.locator(".map-canvas canvas")).toHaveCSS("cursor", "crosshair");
    const map = page.getByLabel("Interactive cemetery map", { exact: true });
    const box = (await map.boundingBox())!;
    for (const fraction of [0.45, 0.6]) {
      const point = { x: box.x + box.width * fraction, y: box.y + box.height * 0.65 };
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe("CANVAS");
      await page.mouse.click(point.x, point.y);
    }
    await expect(page.locator(".map-measurement")).toContainText("2 points measured.");
    await expect(page.locator(".map-measurement strong")).toHaveText(/[\d.]+ (ft|mi)/);
    const featureTypes = () => page.evaluate(async () => {
      const data = await (window.mapHighlightTest.map.getSource("measurement") as GeoJSONSource).getData() as GeoJSON.FeatureCollection;
      return data.features.map(feature => feature.geometry.type);
    });
    await expect.poll(featureTypes).toEqual(["LineString", "Point", "Point"]);
    await page.getByRole("button", { name: "Stop measuring distances" }).click();
    await expect(page.locator(".map-measurement")).toContainText("2 points measured.");
    await page.screenshot({ path: testInfo.outputPath(`map-measurement-${width}.png`) });
    await page.getByRole("button", { name: "Clear measurement", exact: true }).click();
    await expect.poll(featureTypes).toEqual([]);
    await expect(page.locator(".map-measurement")).toHaveCount(0);
    const afterCounts = await page.evaluate(() => ({ ...window.mapHighlightTest.calls }));
    for (const id of ["boundary", "sections", "lots", "graves", "headstones"]) expect(afterCounts[id]).toBe(sourceCounts[id]);
    await page.setViewportSize({ width: width + 100, height: 950 });
    await expect.poll(() => page.evaluate(() => {
      const map = window.mapHighlightTest.map;
      return Math.abs(map.getCanvas().clientWidth - map.getContainer().clientWidth);
    })).toBeLessThanOrEqual(1);
  });
}

test("map point picking fills marker coordinates and keeps the selected gravesite editor", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/api/headstone-lookups*", route => route.fulfill({ json: {
    markerTypes: [marker.markerType], markerScopes: [marker.markerScope],
    materials: [marker.material], conditions: [marker.condition],
  } }));
  await page.route("https://imagery.pasda.psu.edu/**", route => route.abort());
  await page.route("https://gisdata.alleghenycounty.us/**", route => route.abort());
  await page.goto("/tests/map-highlighting.html");
  await select(page, "A-TEST");
  await page.getByRole("tab", { name: "Monuments and photos" }).click();
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  const form = page.locator("form").filter({ has: page.getByLabel("Marker ID", { exact: true }) });
  await form.getByRole("button", { name: "Pick point on map", exact: true }).click();
  await expect(page.locator(".map-placement")).toContainText("Pick marker point");
  await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.isMoving())).toBe(false);
  const point = await page.evaluate(() => {
    const map = window.mapHighlightTest.map;
    const rect = map.getCanvas().getBoundingClientRect();
    const x = Math.floor(rect.left + rect.width * .5);
    const y = Math.floor(rect.top + rect.height * .65);
    const coordinate = map.unproject([x - rect.left, y - rect.top]);
    return { x, y, latitude: coordinate.lat.toFixed(8), longitude: coordinate.lng.toFixed(8) };
  });
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe("CANVAS");
  await page.mouse.click(point.x, point.y);
  await expect(form.getByLabel("Latitude", { exact: true })).toHaveValue(point.latitude);
  await expect(form.getByLabel("Longitude", { exact: true })).toHaveValue(point.longitude);
  await expect(page.locator(".detail-panel")).toContainText("Record ID: A-TEST");
  await expect(page.locator(".map-placement")).toHaveCount(0);
});
