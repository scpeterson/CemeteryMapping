import { expect, test } from "@playwright/test";
import { select } from "./fixtures/cemetery";
import { marker, overviewFixture, overviewGrave } from "./fixtures/overview";

for (const record of ["marker", "burial"] as const) {
  test(`${record} save clears its draft, while a failed save preserves it`, async ({ page }) => {
    await overviewFixture(page);
    await page.route("**/api/headstone-lookups", (route) => route.fulfill({ json: {
      markerTypes: [marker.markerType], markerScopes: [marker.markerScope],
      materials: [marker.material], conditions: [marker.condition],
    } }));
    let failSave = true;
    await page.route(record === "marker" ? "**/api/headstones/marker-1" : "**/api/burials/alice", async (route) => {
      if (route.request().method() !== "PATCH") return route.fulfill({ json: marker });
      if (failSave) return route.fulfill({ status: 500, json: { error: "Test save failure" } });
      const input = route.request().postDataJSON();
      return route.fulfill({ json: record === "marker"
        ? { ...marker, inscription: input.inscription }
        : { ...overviewGrave("A-TEST").burials[0], person: { ...overviewGrave("A-TEST").burials[0].person, firstName: input.firstName } },
      });
    });
    await page.goto("/");
    await select(page, "A-TEST");
    await page.getByRole("tab", { name: record === "marker" ? "Monuments and photos" : "People and ownership" }).click();
    const edit = page.getByRole("button", { name: record === "marker" ? "Edit marker HS-OVERVIEW" : "Edit burial Alice Example" });
    await edit.click();
    const field = page.getByRole("textbox", { name: record === "marker" ? "Inscription" : "First name", exact: true });
    await field.fill("Saved regression value");
    const save = page.getByRole("button", { name: record === "marker" ? "Save marker" : "Save burial", exact: true });
    await save.click();
    await expect(page.getByText(/returned 500: Test save failure/)).toBeVisible();
    let warnings = 0;
    page.on("dialog", async (dialog) => { warnings++; await dialog.dismiss(); });
    const destination = page.getByRole("tab", { name: "Overview", exact: true });
    await destination.click();
    expect(warnings).toBe(1);
    await expect(field).toHaveValue("Saved regression value");
    failSave = false;
    await save.click();
    await expect(save).toHaveCount(0);
    await destination.click();
    await expect(destination).toHaveAttribute("aria-selected", "true");
    expect(warnings).toBe(1);
  });
}
