import { expect, test } from "@playwright/test";
import { formatGraveLabel, formatGraveLocation } from "../src/lib/format";
import { searchGraves } from "../src/lib/search";
import type { CemeteryData, GraveSpaceSummary } from "../src/types";

test("grave labels omit lots but location and old-label search retain them", () => {
  const grave = { id: "TLC-GPS-0270", cemeteryId: "test", cemeteryName: "Test", section: "C", lot: "52", space: "0270",
    displayLabel: "C-0270", labelAliases: ["C-52-0270"], status: "available" } as GraveSpaceSummary;
  expect(formatGraveLabel(grave)).toBe("C-0270");
  expect(formatGraveLabel({ section: "A", lot: "", space: "0087" })).toBe("A-0087");
  expect(formatGraveLabel({ section: "C", lot: "52", space: "0270A" })).toBe("C-0270A");
  expect(formatGraveLabel({ ...grave, displayLabel: "C-52-0270" })).toBe("C-52-0270");
  expect(formatGraveLocation(grave)).toContain("Lot 52");
  const data = { graves: [grave] } as CemeteryData;
  for (const query of ["C-0270", "C-52-0270"]) expect(searchGraves(data, query, new Set(["available"]))[0].grave.id).toBe(grave.id);
});

test("old-label fallback search displays the standardized label and retains lot context", async ({ page }) => {
  const { fixture, cemeteryId, geometry } = await import("./fixtures/cemetery");
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
    boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" }, geometry }], sections: [], lots: [], headstones: [],
    graves: [{ id: "TLC-GPS-0270", cemeteryId, cemeteryName: "Test Cemetery", section: "C", lot: "52", space: "0270", displayLabel: "C-0270", labelAliases: ["C-52-0270"], status: "available", geometry }],
  } }));
  await page.route("**/api/search**", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/");
  await page.getByLabel("Search cemetery records").fill("C-52-0270");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card .result-title")).toHaveText("C-0270");
  await expect(page.locator(".result-card")).toContainText("Lot 52");
});
