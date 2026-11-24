import { expect, test } from "@playwright/test";
import { marker } from "./fixtures/overview";
import { detail, fixture, gravePath, select } from "./fixtures/cemetery";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII=", "base64");
for (const explicitThumbnail of [true, false]) {
  test(`gallery defers ${explicitThumbnail ? "stored" : "generated"} thumbnails until visible and originals until opened`, async ({ page }) => {
    await fixture(page);
    const original = "/media/11111111-1111-4111-8111-111111111111.jpg";
    const thumbnailUrl = explicitThumbnail ? "/media/thumbnail.png" : "";
    const preview = thumbnailUrl || original + "?variant=thumbnail";
    const downloads: string[] = [];
    await page.route("**/media/**", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer photo-test");
      const url = new URL(route.request().url());
      downloads.push(url.pathname + url.search);
      await route.fulfill({ contentType: "image/png", body: png });
    });
    await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: { ...detail("A-TEST"), headstones: [{ ...marker, mediaAssets: [{ id: "photo", assetType: "photo", fileUrl: original, thumbnailUrl, notes: "Deferred photo" }] }] } }));
    await page.goto("/");
    await page.evaluate(async () => {
      const api = await import("/src/api/apiClient.ts");
      api.setAccessTokenProvider(async () => "photo-test");
      // Hold all gallery intersections until the test explicitly reveals one.
      const callbacks: IntersectionObserverCallback[] = [];
      Object.assign(window, { photoIntersections: callbacks });
      window.IntersectionObserver = class {
        constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
        observe() {} disconnect() {} unobserve() {} takeRecords() { return []; }
        root = null; rootMargin = "200px"; thresholds = [0];
      };
    });
    await select(page, "A-TEST");
    await page.getByRole("tab", { name: "Monuments and photos" }).click();
    await page.locator(".all-monument-photos > button").click();
    await expect(page.locator(".media-gallery-item")).toBeVisible();
    // The overview may load its thumbnail, but no gallery download or original may start.
    const before = downloads.length;
    expect(downloads).not.toContain(original);
    await expect(page.locator(".media-gallery-item img")).toHaveCount(0);
    await page.evaluate(() => {
      const callbacks = (window as unknown as { photoIntersections: IntersectionObserverCallback[] }).photoIntersections;
      callbacks.forEach((callback) => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    });
    await expect(page.locator(".media-gallery-item img")).toHaveAttribute("src", /^blob:/u);
    expect(downloads.length).toBeGreaterThan(before);
    expect(downloads).toContain(preview);
    expect(downloads).not.toContain(original);
    await page.getByRole("link", { name: "Open photo: Deferred photo" }).click();
    await expect(page.getByRole("dialog", { name: "Record photo" }).getByRole("img")).toHaveAttribute("src", /^blob:/u);
    expect(downloads).toContain(original);
    await page.getByRole("button", { name: "Close photo" }).click();
    await expect(page.getByRole("dialog", { name: "Record photo" })).toHaveCount(0);
  });
}
