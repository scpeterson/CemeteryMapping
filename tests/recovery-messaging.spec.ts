import { expect, test } from "@playwright/test";
import { fixture, select, showApplicationActions } from "./fixtures/cemetery";
import { overviewFixture } from "./fixtures/overview";

test("failed editing options disable saves and dropdowns until retry succeeds", async ({ page }) => {
  await overviewFixture(page);
  let available = false;
  await page.route("**/api/headstone-lookups", (route) => available ? route.fulfill({ json: {} }) : route.fulfill({ status: 503, json: {} }));
  await page.goto("/"); await select(page, "A-TEST");
  await page.getByRole("tab", { name: "People and ownership" }).click();
  await page.getByRole("button", { name: "Edit burial Alice Example" }).click();
  const form = page.locator(".burial-form");
  await expect(form.getByText(/Editing options couldn't be loaded/)).toBeVisible();
  await expect(form.getByRole("button", { name: "Save burial" })).toBeDisabled();
  await expect(form.getByRole("combobox").first()).toBeDisabled();
  await form.getByRole("textbox", { name: "First name", exact: true }).fill("Alicia");
  available = true;
  await form.getByRole("button", { name: "Retry editing options" }).click();
  await expect(form.getByRole("button", { name: "Save burial" })).toBeEnabled();
  await expect(form.getByRole("textbox", { name: "First name", exact: true })).toHaveValue("Alicia");
});

test("photo failure offers sign-in guidance and retry without claiming no photo exists", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/media/*.png", (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto("/"); await select(page, "A-TEST");
  const photo = page.locator(".overview-photo");
  await expect(photo.getByRole("alert")).toContainText("Sign in again");
  await expect(photo.getByText("No photo available.")).toHaveCount(0);
  await page.unroute("**/media/*.png");
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAaX2RaAAAAAASUVORK5CYII=", "base64");
  await page.route("**/media/*.png", (route) => route.fulfill({ contentType: "image/png", body: pixel }));
  await photo.getByRole("button", { name: "Retry photo" }).click();
  await expect(photo.getByRole("button", { name: /Open .*photo/ })).toBeVisible();
});

test("report catalog failures can be retried and stale results are labeled", async ({ page }) => {
  await fixture(page);
  let catalogAvailable = false;
  let runAvailable = true;
  const report = { id: "test", title: "Test report", category: "Records", requiredRole: "reader", parameters: [], examples: [], description: "Test" };
  await page.route("**/api/reports", (route) => catalogAvailable ? route.fulfill({ json: [report] }) : route.fulfill({ status: 503, json: {} }));
  await page.route("**/api/reports/run", (route) => runAvailable ? route.fulfill({ json: { report, generatedAt: "2026-09-16T12:00:00Z", columns: [{ key: "name", label: "Name" }], rows: [{ name: "Previous record" }], notes: [] } }) : route.fulfill({ status: 503, json: {} }));
  await page.goto("/"); await showApplicationActions(page);
  await page.getByRole("button", { name: /^Open reports:/ }).click();
  await expect(page.getByText("Reports couldn't be loaded.")).toBeVisible();
  await expect(page.getByText("No reports available")).toHaveCount(0);
  catalogAvailable = true;
  await page.getByRole("button", { name: "Retry loading reports" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Previous record", { exact: true })).toBeVisible();
  runAvailable = false;
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText(/Previous results—latest request failed/)).toBeVisible();
  runAvailable = true;
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText(/Previous results—latest request failed/)).toHaveCount(0);
});

test("place search preserves permission guidance and can retry", async ({ page }) => {
  await overviewFixture(page);
  let available = false;
  await page.route("**/api/places/search?**", (route) => available ? route.fulfill({ json: { available: true, results: [] } }) : route.fulfill({ status: 403, json: {} }));
  await page.goto("/"); await select(page, "A-TEST");
  await page.getByRole("tab", { name: "People and ownership" }).click();
  await page.getByRole("button", { name: "Edit burial Alice Example" }).click();
  await page.getByRole("textbox", { name: "Find another verified death location" }).fill("Pittsburgh");
  await page.getByRole("button", { name: "Search geographic registry" }).click();
  await expect(page.getByRole("alert")).toContainText("don't have permission");
  available = true;
  await page.getByRole("button", { name: "Retry place search" }).click();
  await expect(page.getByText("No matching places found.")).toBeVisible();
});

test("unreadable saved points are preserved and loading can be retried", async ({ page }) => {
  await fixture(page);
  await page.addInitScript(() => localStorage.setItem("cemetery-mapping-control-points-v1", "broken-json"));
  await page.goto("/"); await showApplicationActions(page);
  await page.getByRole("button", { name: /^Open control point collector:/ }).click();
  const dialog = page.getByRole("dialog", { name: "Control point collector", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("Saved control points couldn't be loaded");
  expect(await page.evaluate(() => localStorage.getItem("cemetery-mapping-control-points-v1"))).toBe("broken-json");
  await page.evaluate(() => localStorage.setItem("cemetery-mapping-control-points-v1", "[]"));
  await dialog.getByRole("button", { name: "Retry loading control points" }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
