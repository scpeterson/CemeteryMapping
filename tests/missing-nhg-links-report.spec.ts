import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";
import { reportDefinitions } from "../server/reports/definitions.mjs";

for (const role of ["cemetery-admin", "admin"]) {
  test(`missing NHG links shows monument IDs, location names and NHG inclusion for ${role}`, async ({ page }) => {
    await fixture(page);
    await page.route("**/api/me", (route) => route.fulfill({ json: { role, assignedCemeteryIds: [], permissions: {} } }));
    const definition = reportDefinitions.find((r) => r.id === "missing-nhg-links")!;
    await page.route("**/api/reports", (route) => route.fulfill({ json: [definition] }));
    await page.route("**/api/reports/run", async (route) => {
      expect(route.request().postDataJSON().reportId).toBe(definition.id);
      await route.fulfill({ json: {
        report: definition, summary: "2 eligible monuments checked; 1 lacks a confirmed direct NHG link.",
        generatedAt: new Date().toISOString(), subtitle: "All sections · Plot markers included · Not listed in NHG excluded",
        columns: [{ key: "gravesites", label: "Gravesite name(s)" },
          { key: "monument", label: "Monument ID" }, { key: "nhg_inclusion", label: "NHG inclusion status" }],
        rows: [{ gravesites: "A-0087", monument: "TLC-HS-0087", nhg_inclusion: "Listed in NHG" }],
        notes: ["Monuments marked Not listed in NHG are excluded."],
      } });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Open reports: run saved cemetery reports and guided queries", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Data maintenance", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "NHG inclusion status", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Related record has NHG link", exact: true })).toHaveCount(0);
    const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "A-0087", exact: true }) });
    await expect(row).toContainText("TLC-HS-0087");
    await expect(row.getByRole("cell", { name: "Listed in NHG", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Reports", exact: true })).toContainText("Monuments marked Not listed in NHG are excluded.");
  });
}
