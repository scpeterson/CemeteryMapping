import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";
import { reportDefinitions } from "../server/reports/definitions.mjs";

test("photo maintenance report submits section, plot-marker and issue filters", async ({ page }) => {
  await fixture(page);
  const definition = reportDefinitions.find((r) => r.id === "monument-photo-exceptions")!;
  await page.route("**/api/reports", (route) => route.fulfill({ json: [definition] }));
  await page.route("**/api/reports/run", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ reportId: definition.id, parameters: {
      sectionNames: "A,B,C,D", includePlotMarkers: "no", issue: "missing-photo",
    } });
    await route.fulfill({ json: { report: definition, summary: "2 monuments need photos.", generatedAt: new Date().toISOString(),
      columns: [{ key: "monument", label: "Monument ID" }, { key: "gravesites", label: "Gravesite(s)" }],
      rows: [{ monument: "TLC-HS-0165", gravesites: "Standalone marker" }], notes: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open reports: run saved cemetery reports and guided queries", exact: true }).click();
  await expect(page.getByText("Data maintenance", { exact: true })).toBeVisible();
  await page.getByLabel("Sections (comma-separated; blank for all)", { exact: true }).fill("A,B,C,D");
  await page.getByRole("combobox", { name: "Include plot markers", exact: true }).selectOption("no");
  await page.getByRole("combobox", { name: "Photo issue", exact: true }).selectOption("missing-photo");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Reports", exact: true })).toContainText("2 monuments need photos.");
  await expect(page.getByRole("cell", { name: "Standalone marker", exact: true })).toBeVisible();
});
