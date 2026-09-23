import { expect, test } from "@playwright/test";
import { graveOverviewImages, overviewImages } from "../src/components/detail/overviewImages";
import type { Headstone, MediaAsset } from "../src/types";
import { marker, overviewFixture, overviewGrave } from "./fixtures/overview";
import { gravePath, select } from "./fixtures/cemetery";

const photo = (id: string, date: string, isPrimary = false) => ({
  id, assetType: "photo", fileUrl: `/media/${id}.png`, notes: id, capturedAt: date, isPrimary,
}) as MediaAsset;
const nannie = photo("nannie", "2020-01-01", true);
const front = photo("front", "2021-01-01");
const william = photo("william", "2026-01-01", true);
const grave = { id: "A-TEST", burials: [{ id: "alice" }], mediaAssets: [] as MediaAsset[] };
const individual = { ...marker, associatedGravesiteIds: ["A-TEST"], burialIds: ["alice"], mediaAssets: [nannie] } as Headstone;
const shared = { ...marker, mediaAssets: [william, front], faces: [
  { id: "front-face", label: "Front", inscription: "Nannie", notes: "", burialIds: ["alice"], mediaAssetIds: ["front"] },
  { id: "back-face", label: "Back", inscription: "William", notes: "", burialIds: ["bob"], mediaAssetIds: ["william"] },
] } as Headstone;

test("individual marker beats a newer primary on a shared monument; duplicates keep the individual primary", () => {
  const images = graveOverviewImages({ ...grave, mediaAssets: [{ ...nannie, isPrimary: false }, front] }, [shared, individual]);
  expect(images.map((image) => image.url)).toEqual([nannie.fileUrl, front.fileUrl, william.fileUrl]);
  expect(images[0].isPrimary).toBe(true);
});

test("individual markers can be identified by burial links when gravesite IDs are absent", () => {
  const legacyIndividual = { ...individual, associatedGravesiteIds: [] };
  expect(graveOverviewImages(grave, [shared, legacyIndividual])[0].url).toBe(nannie.fileUrl);
  const otherGrave = { ...legacyIndividual, associatedGravesiteIds: ["B-TEST"] };
  expect(graveOverviewImages(grave, [shared, otherGrave])[0].url).toBe(front.fileUrl);
});

test("an explicit gravesite primary wins over individual marker primaries", () => {
  const own = photo("own", "1900-01-01", true);
  expect(graveOverviewImages({ ...grave, mediaAssets: [own] }, [individual, shared])[0].url).toBe(own.fileUrl);
});

test("shared monument face follows burial IDs and marker Overview keeps its own primary", () => {
  expect(graveOverviewImages(grave, [shared])[0].url).toBe(front.fileUrl);
  expect(graveOverviewImages({ ...grave, burials: [{ id: "bob" }] }, [shared])[0].url).toBe(william.fileUrl);
  expect(overviewImages([], [shared])[0].url).toBe(william.fileUrl);
});

test("missing face links fall back and empty or legacy photos remain usable", () => {
  expect(graveOverviewImages({ ...grave, burials: [] }, [shared])[0].url).toBe(william.fileUrl);
  expect(graveOverviewImages(grave, [{ ...shared, faces: [{ ...shared.faces![0], mediaAssetIds: ["missing"] }] }])[0].url).toBe(william.fileUrl);
  expect(graveOverviewImages(grave, [{ ...individual, mediaAssets: [], photoUrl: "/legacy" }, shared])[0].url).toBe("/legacy");
  expect(graveOverviewImages(grave, [])).toEqual([]);
});

test("shared primary flags do not leak into the gravesite photo tier", () => {
  const own = photo("own", "2022-01-01");
  const images = graveOverviewImages({ ...grave, mediaAssets: [{ ...william, isPrimary: false, capturedAt: "2020-01-01" }, own] }, [shared]);
  expect(images[0].url).toBe(own.fileUrl);
});

test("gravesite Overview shows the associated face, while the monument retains its primary", async ({ page }) => {
  await overviewFixture(page);
  await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: { ...overviewGrave("A-TEST"), mediaAssets: [], headstones: [shared] } }));
  await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: shared }));
  await page.goto("/tests/auth.html");
  await select(page, "A-TEST");
  const panel = page.getByRole("tabpanel", { name: "Overview", exact: true });
  await expect(panel.getByRole("img", { name: "front", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(panel.getByRole("img", { name: "william", exact: true })).toBeVisible();
});
