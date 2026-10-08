import { expect, test, type Locator } from "@playwright/test";
import { gravePath, select } from "./fixtures/cemetery";
import { marker, overviewFixture, overviewGrave } from "./fixtures/overview";

async function expectNaturalRatio(image: Locator, ratio: number) {
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const dimensions = await image.evaluate((img: HTMLImageElement) => ({
    ratio: img.clientWidth / img.clientHeight,
    fit: getComputedStyle(img).objectFit,
  }));
  expect(dimensions.ratio).toBeCloseTo(ratio, 1);
  expect(dimensions.fit).toBe("contain");
}

for (const width of [1280, 390]) {
  test(`portrait and landscape marker photos keep their full proportions in both galleries at ${width}px`, async ({ page }) => {
    await overviewFixture(page);
    const photos = Array.from({ length: 5 }, (_, i) => ({
      id: `orientation-${i}`, assetType: "photo", fileUrl: `/media/orientation-${i}.svg`,
      notes: i % 2 ? `Landscape ${i}` : `Portrait ${i}`, isPrimary: i === 0,
    }));
    await page.route("**/media/orientation-*.svg", (route) => {
      const portrait = Number(new URL(route.request().url()).pathname.match(/orientation-(\d)/)?.[1]) % 2 === 0;
      const w = portrait ? 300 : 600, h = portrait ? 600 : 300;
      return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#aabbcc"/><rect x="2" y="2" width="${w-4}" height="${h-4}" fill="none" stroke="red" stroke-width="4"/></svg>` });
    });
    await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: {
      ...overviewGrave("A-TEST"), headstones: [{ ...marker, mediaAssets: photos }],
    } }));
    await page.goto("/");
    await select(page, "A-TEST");
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("tab", { name: "Monuments" }).click();
    const preview = page.locator(".media-gallery").first();
    await expect(preview.locator(".media-gallery-card")).toHaveCount(4);
    await preview.locator(".media-gallery-card").nth(0).scrollIntoViewIfNeeded();
    await expectNaturalRatio(preview.getByRole("img", { name: "Portrait 0", exact: true }), 0.5);
    await preview.locator(".media-gallery-card").nth(1).scrollIntoViewIfNeeded();
    await expectNaturalRatio(preview.getByRole("img", { name: "Landscape 1", exact: true }), 2);
    await page.getByRole("button", { name: "View all photos (5)" }).click();
    const expanded = page.getByRole("dialog", { name: "All photos", exact: true });
    await expect(expanded.locator(".media-gallery-card")).toHaveCount(5);
    await expanded.locator(".media-gallery-card").nth(0).scrollIntoViewIfNeeded();
    await expectNaturalRatio(expanded.getByRole("img", { name: "Portrait 0", exact: true }), 0.5);
    await expanded.locator(".media-gallery-card").nth(1).scrollIntoViewIfNeeded();
    await expectNaturalRatio(expanded.getByRole("img", { name: "Landscape 1", exact: true }), 2);
    expect(await expanded.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expanded.screenshot({ path: `/tmp/portrait-gallery-${width}.png` });
  });
}
