import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry } from "./fixtures/cemetery";
import type { GeoJSONSource, Map } from "maplibre-gl";

declare global { interface Window { mapHighlightTest: { map: Map; calls: Record<string, number> } } }

test("section geometry and label data follow unresolved, single and all-cemetery scope", async ({ page }) => {
  await fixture(page);
  const otherId = "22222222-2222-4222-8222-222222222222";
  let releaseUser!: () => void;
  const ready = new Promise<void>((resolve) => { releaseUser = resolve; });
  await page.route("**/api/me", async (route) => {
    await ready;
    await route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: {} } });
  });
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
    boundaries: [cemeteryId, otherId].map((id) => ({ type: "Feature", properties: { id, name: id }, geometry })),
    sections: [cemeteryId, otherId].map((id) => ({ id: "A", cemeteryId: id, name: `Section ${id}`, alternateNames: [], geometry })),
    lots: [], graves: [], headstones: [],
  } }));
  await page.goto("/tests/map-highlighting.html");
  await expect.poll(() => page.evaluate(() => Boolean(window.mapHighlightTest?.map.getSource("sections")))).toBe(true);
  const sectionCemeteries = () => page.evaluate(async () => {
    const data = await (window.mapHighlightTest.map.getSource("sections") as GeoJSONSource).getData() as GeoJSON.FeatureCollection;
    return data.features.map((feature) => feature.properties?.cemeteryId);
  });
  expect(await sectionCemeteries()).toEqual([]);
  releaseUser();
  await expect.poll(sectionCemeteries).toEqual([cemeteryId, otherId]);
  for (const id of [cemeteryId, otherId]) {
    await page.getByRole("combobox", { name: "Cemetery", exact: true }).selectOption(id);
    await expect.poll(sectionCemeteries).toEqual([id]);
  }
  await page.getByRole("combobox", { name: "Cemetery", exact: true }).selectOption("");
  await expect.poll(sectionCemeteries).toEqual([cemeteryId, otherId]);
  expect(await page.evaluate(() => window.mapHighlightTest.map.getLayer("sections-label")?.source)).toBe("sections");
});
