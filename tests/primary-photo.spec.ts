import { expect, test } from "@playwright/test";
import { sortedMediaAssets } from "../src/lib/media";
import { overviewImages } from "../src/components/detail/overviewImages";
import type { MediaAsset, Headstone } from "../src/types";
import { gravePath, select } from "./fixtures/cemetery";
import { marker, overviewFixture, overviewGrave } from "./fixtures/overview";

test("primary overrides chronology while other photos stay newest first", () => {
  const photos = [
    { id: "front", assetType: "photo", fileUrl: "/front", capturedAt: "2020-01-01", isPrimary: true },
    { id: "old", assetType: "photo", fileUrl: "/old", uploadedAt: "2021-01-01" },
    { id: "back", assetType: "photo", fileUrl: "/back", capturedAt: "2026-01-01" },
  ] as MediaAsset[];
  expect(sortedMediaAssets(photos).map((photo) => photo.id)).toEqual(["front", "back", "old"]);
  expect(sortedMediaAssets(photos.map((photo) => ({ ...photo, isPrimary: false }))).map((photo) => photo.id)).toEqual(["back", "old", "front"]);
  expect(overviewImages(photos, [{ mediaAssets: [{ ...photos[0], isPrimary: false }] } as Headstone])[0].url).toBe("/front");
});

test("select, replace and remove a primary photo, including after reload", async ({ page }, testInfo) => {
  await overviewFixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: { canManageUsers: true, canOpenAdminPanel: true, canViewOwnership: true, canUpdateGravesites: true, canDeletePhotos: true } } }));
  let primary = "";
  const record = () => ({ ...overviewGrave("A-TEST"), headstones: [{ ...marker, mediaAssets: marker.mediaAssets.map((photo) => ({ ...photo, mediaLinkId: `link-${photo.id}`, mediaLinkType: "headstone", isPrimary: primary === photo.id })) }] });
  await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: record() }));
  await page.route("**/api/media-assets/*/order", (route) => {
    const body = route.request().postDataJSON();
    primary = body.direction === "primary" ? body.linkId.replace("link-", "") : "";
    return route.fulfill({ json: { moved: true, updates: marker.mediaAssets.map((photo) => ({ id: `link-${photo.id}`, is_primary: primary === photo.id })) } });
  });
  await page.goto("/tests/auth.html");
  await select(page, "A-TEST");
  const overview = page.getByRole("tabpanel", { name: "Overview", exact: true });
  await page.getByRole("tab", { name: "Monuments" }).click();
  await page.getByRole("button", { name: "Make primary: old-marker.png", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove primary: old-marker.png", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("primary-photo-gallery.png"), fullPage: true });
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(overview.getByRole("img", { name: "old-marker", exact: true })).toBeVisible();
  await expect(overview.getByRole("button", { name: "Open primary photo" })).toBeVisible();
  await page.reload();
  await select(page, "A-TEST");
  await expect(overview.getByRole("img", { name: "old-marker", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Monuments" }).click();
  await page.getByRole("button", { name: "Make primary: latest-marker.png", exact: true }).click();
  await expect(page.getByRole("button", { name: "Make primary: old-marker.png", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove primary: latest-marker.png", exact: true }).click();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(overview.getByRole("button", { name: "Open latest photo" })).toBeVisible();
  await expect(overview.getByRole("img", { name: "latest-marker", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Monuments" }).click();
  await page.getByRole("button", { name: "Make primary: old-marker.png", exact: true }).click();
  await page.route("**/api/media-assets/old-marker", (route) => route.fulfill({ json: { id: "old-marker" } }));
  page.once("dialog", (dialog) => dialog.accept("Remove incorrect photo"));
  await page.getByRole("button", { name: "Delete photo old-marker.png", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove primary: old-marker.png", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(overview.getByRole("img", { name: "latest-marker", exact: true })).toBeVisible();

});
