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
