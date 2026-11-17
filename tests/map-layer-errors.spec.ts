import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=", "base64");

test("provider notices are independent, retries recover, and Diagram remains usable", async ({ page }) => {
  await fixture(page);
  let imageryAvailable = false;
  let parcelsAvailable = false;
  await page.route("https://imagery.pasda.psu.edu/**", (route) => imageryAvailable
    ? route.fulfill({ contentType: "image/png", body: pixel }) : route.abort("failed"));
  await page.route("https://gisdata.alleghenycounty.us/**", (route) => parcelsAvailable
    ? route.fulfill({ contentType: "image/png", body: pixel }) : route.abort("failed"));
  await page.goto("/");
  const notice = page.getByRole("region", { name: "Map layer availability" });
  await expect(notice).toContainText("Aerial imagery (PASDA)");
  await expect(notice).toContainText("Parcel boundaries (Allegheny County)");
  await expect(notice.getByRole("status")).toContainText("Cemetery records remain available");
  await expect(notice.getByRole("button", { name: "Retry Aerial imagery (PASDA)", exact: true })).toHaveCount(1);
  await notice.getByRole("button", { name: "Switch to Diagram view" }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Diagram view:/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Geographic view:/ }).click();
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Retry Aerial imagery (PASDA)", exact: true }).click();
  await expect(notice).toContainText("Aerial imagery (PASDA)");
  imageryAvailable = true;
  await notice.getByRole("button", { name: "Retry Aerial imagery (PASDA)", exact: true }).click();
  await expect(notice.getByRole("button", { name: "Retry Aerial imagery (PASDA)", exact: true })).toHaveCount(0);
  await expect(notice).toContainText("Parcel boundaries (Allegheny County)");
  parcelsAvailable = true;
  await notice.getByRole("button", { name: "Retry Parcel boundaries (Allegheny County)", exact: true }).click();
  await expect(notice).toHaveCount(0);
});

test("notices clear when provider requests recover after changing the map view", async ({ page }) => {
  await fixture(page);
  let available = false;
  for (const url of ["https://imagery.pasda.psu.edu/**", "https://gisdata.alleghenycounty.us/**"]) {
    await page.route(url, (route) => available
      ? route.fulfill({ contentType: "image/png", body: pixel }) : route.abort("failed"));
  }
  await page.goto("/");
  const notice = page.getByRole("region", { name: "Map layer availability" });
  await expect(notice).toContainText("Parcel boundaries");
  await expect(notice).toContainText("Aerial imagery");
  available = true;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(notice).toHaveCount(0);
});

test("mobile workspace changes skip hidden imagery and combine visible resize updates", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await fixture(page);
  const requests: string[] = [];
  await page.route("https://imagery.pasda.psu.edu/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "image/png", body: pixel });
  });
  await page.route("https://gisdata.alleghenycounty.us/**", route => route.fulfill({ contentType: "image/png", body: pixel }));
  await page.goto("/tests/map-highlighting.html");
  await expect.poll(() => page.evaluate(() => window.mapHighlightTest?.map.loaded())).toBe(true);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const before = requests.length;
  const views = page.getByRole("navigation", { name: "Workspace views" });
  await views.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.locator(".map-canvas")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 852 });
  // Let the actual ResizeObserver and map events finish while the map is hidden.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(requests.length).toBe(before);
  await views.getByRole("button", { name: "Map", exact: true }).click();
  await expect.poll(() => requests.length).toBe(before + 1);
  await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.loaded())).toBe(true);
  expect(requests.length).toBe(before + 1);
  for (const url of requests) {
    const dimensions = new URL(url).searchParams.get("size")!.split(",").map(Number);
    expect(dimensions.every(value => value > 1)).toBe(true);
  }
  await expect(page.getByRole("region", { name: "Map layer availability" })).toHaveCount(0);
});

test("returning from Diagram requests the current imagery viewport", async ({ page }) => {
  await fixture(page);
  const requests: string[] = [];
  await page.route("https://imagery.pasda.psu.edu/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: "image/png", body: pixel });
  });
  await page.route("https://gisdata.alleghenycounty.us/**", route => route.fulfill({ contentType: "image/png", body: pixel }));
  await page.goto("/tests/map-highlighting.html");
  await expect.poll(() => page.evaluate(() => window.mapHighlightTest?.map.loaded())).toBe(true);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: /^Diagram view:/ }).click();
  const before = requests.length;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.isMoving())).toBe(false);
  expect(requests.length).toBe(before);
  await page.getByRole("button", { name: /^Geographic view:/ }).click();
  await expect.poll(() => requests.length).toBe(before + 1);
  await expect.poll(() => page.evaluate(() => window.mapHighlightTest.map.loaded())).toBe(true);
  expect(requests.at(-1)).not.toBe(requests[before - 1]);
  await expect(page.getByRole("region", { name: "Map layer availability" })).toHaveCount(0);
});
