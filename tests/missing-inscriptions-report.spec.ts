import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";
import { reportDefinitions } from "../server/reports/definitions.mjs";

test("missing inscription report shows monument IDs and face details for cemetery admins", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "cemetery-admin", assignedCemeteryIds: [], permissions: {} } }));
  const definition = reportDefinitions.find((r) => r.id === "missing-monument-inscriptions")!;
  await page.route("**/api/reports", (route) => route.fulfill({ json: [definition] }));
  await page.route("**/api/reports/run", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ reportId: definition.id, parameters: {} });
    await route.fulfill({ json: { report: definition, summary: "1 monument has missing inscription data.", generatedAt: new Date().toISOString(),
      subtitle: "Sections A–D · Plot markers included",
      columns: [{ key: "monument", label: "Monument ID" }, { key: "missing_faces", label: "Faces needing inscription data" }],
      rows: [{ monument: "TLC-HS-0165", missing_faces: "Back (face 2)" }],
      notes: ["[blank] and [illegible] are valid data."] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open reports: run saved cemetery reports and guided queries", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data maintenance", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("cell", { name: "TLC-HS-0165", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Back (face 2)", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Reports", exact: true })).toContainText("[blank] and [illegible] are valid data.");
});
