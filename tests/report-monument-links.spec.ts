import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, summaries } from "./fixtures/cemetery";
import { marker, markerSummary } from "./fixtures/overview";
import { reportDefinitions } from "../server/reports/definitions.mjs";

for (const reportId of ["missing-monument-inscriptions", "monument-photo-exceptions"]) {
  for (const role of ["cemetery-admin", "admin"]) {
    for (const located of [true, false]) {
      test(`${reportId} opens monument records and zooms for ${role} (${located ? "mapped" : "unmapped"})`, async ({ page }) => {
        await fixture(page);
        await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
          boundaries: [{ type: "Feature", properties: { id: cemeteryId, name: "Test Cemetery" },
            geometry: { ...geometry, coordinates: [[[-81,39],[-79,39],[-79,41],[-81,41],[-81,39]]] } }],
          sections: [], lots: [], graves: summaries, headstones: [],
        } }));
        await page.route("**/api/me", (route) => route.fulfill({ json: { role, assignedCemeteryIds: [cemeteryId], permissions: {} } }));
        await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: { ...marker, headstoneId: "TLC-HS-0087" } }));
        const definition = reportDefinitions.find((r) => r.id === reportId)!;
        await page.route("**/api/reports", (route) => route.fulfill({ json: [definition] }));
        await page.route("**/api/reports/run", async (route) => {
          expect(route.request().postDataJSON().reportId).toBe(definition.id);
          await route.fulfill({ json: {
            report: definition, summary: "1 monument needs data maintenance.",
            generatedAt: new Date().toISOString(), subtitle: "Plot markers included",
            columns: [{ key: "gravesites", label: "Gravesite name(s)" },
              { key: "monument", label: "Monument ID" }, { key: "issue", label: "Issue" }],
            rows: [{ monumentRecord: { ...markerSummary, headstoneId: "TLC-HS-0087", geometry: located ? markerSummary.geometry : null }, gravesites: "A-0087", monument: "TLC-HS-0087", issue: "Missing data" }],
            notes: [],
          } });
        });
        await page.goto("/");
        const scaleValue = async () => Number((await page.locator(".map-scale-fraction").innerText()).split(":")[1].replaceAll(",", ""));
        await expect.poll(scaleValue).toBeGreaterThan(10000);
        await page.getByRole("button", { name: "Open reports: run saved cemetery reports and guided queries", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Data maintenance", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Run", exact: true }).click();
        await expect(page.getByRole("columnheader", { name: "Monument ID", exact: true })).toBeVisible();
        const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "A-0087", exact: true }) });
        await expect(row).toContainText("TLC-HS-0087");
        await expect(row.getByRole("cell", { name: "Missing data", exact: true })).toBeVisible();
        const openMonument = page.getByRole("button", { name: "Open monument TLC-HS-0087", exact: true });
        await openMonument.focus();
        await openMonument.press("Enter");
        await expect(page.getByRole("dialog", { name: "Reports", exact: true })).toHaveCount(0);
        await expect(page.locator(".detail-panel")).toContainText("TLC-HS-0087");
        if (located) await expect.poll(scaleValue).toBeLessThan(10000);
        else await expect.poll(scaleValue).toBeGreaterThan(10000);
        await page.getByRole("tab", { name: "Details", exact: true }).click();
        await expect(page.locator(".detail-panel")).toContainText("Family marker");
      });
    }
  }
}
