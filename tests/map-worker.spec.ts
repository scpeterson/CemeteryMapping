import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

test("map worker loads and completes map initialization", async ({ page }) => {
  await fixture(page);
  // Exercise local geometry without depending on county imagery availability.
  await page.route("https://imagery.pasda.psu.edu/**", route => route.abort());
  await page.route("https://gisdata.alleghenycounty.us/**", route => route.abort());
  const workerResponse = page.waitForResponse(response => /maplibre-gl-worker/.test(response.url()));
  await page.goto("/");
  const response = await workerResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/javascript/);
  await page.getByRole("combobox", { name: "Cemetery", exact: true }).selectOption("");
  // Markers are installed in the map's load handler, after worker startup.
  await expect(page.getByLabel("Zoom to Test Cemetery", { exact: true })).toBeVisible();
  const map = page.getByLabel("Interactive cemetery map", { exact: true });
  await expect(map).toHaveCSS("position", "absolute");
  const bounds = await map.boundingBox();
  expect(bounds?.height).toBeGreaterThan(300);
});
