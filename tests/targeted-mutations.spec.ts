import { expect, test } from "@playwright/test";
import type { SetStateAction } from "react";
import type { CemeteryData, GraveSpace, GraveSpaceSummary, Headstone, SaveHeadstoneCreateInput } from "../src/types";
import { detail, fixture } from "./fixtures/cemetery";
import { marker } from "./fixtures/overview";

test("successful mutations update only local records without map or detail refresh", async ({ page }) => {
  await fixture(page);
  await page.goto("/");
  await expect(page.locator(".result-card")).toHaveCount(2);
  const requests: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  await page.route("**/api/cemeteries/*/gravesites/A-TEST/headstones", (route) => route.fulfill({ json: marker }));
  await page.route("**/api/cemeteries/*/grave-spaces/A-TEST/lot", (route) => route.fulfill({ json: { id: "A-TEST", lotId: "new-lot" } }));
  await page.route("**/api/grave-features/remove", (route) => route.fulfill({ json: { id: "remove" } }));
  await page.route("**/api/media-assets/remove", (route) => route.fulfill({ json: { id: "remove" } }));
  await page.route("**/api/media-assets/second/order", (route) => route.fulfill({ json: { moved: true, updates: [] } }));
  const result = await page.evaluate(async ({ initial, other }) => {
    const { createMarkerMutations } = await import("/src/hooks/markerMutations.ts");
    const { createOwnershipMutations } = await import("/src/hooks/ownershipMutations.ts");
    const { createEvidenceMutations } = await import("/src/hooks/evidenceMutations.ts");
    const { createMediaMutations } = await import("/src/hooks/mediaMutations.ts");
    let selected: GraveSpaceSummary | undefined = initial as GraveSpace;
    let grave: GraveSpace | undefined = { ...initial, features: [{ id: "remove" }, { id: "keep" }], mediaAssets: [{ id: "remove" }, { id: "first" }, { id: "second" }] } as GraveSpace;
    let data: CemeteryData = { sections: [], lots: [], graves: [initial as GraveSpace, other as GraveSpace], headstones: [] };
    let selectedMarker: Headstone | undefined;
    let refreshes = 0;
    const apply = <T,>(current: T, update: SetStateAction<T>): T => typeof update === "function" ? (update as (current: T) => T)(current) : update;
    const context = {
      selectedGrave: selected,
      setData: (update: SetStateAction<CemeteryData>) => { data = apply(data, update); },
      setSelectedGrave: (update: SetStateAction<GraveSpaceSummary | undefined>) => { selected = apply(selected, update); },
      setSelectedGraveDetails: (update: SetStateAction<GraveSpace | undefined>) => { grave = apply(grave, update); },
      setSelectedHeadstoneDetails: (update: SetStateAction<Headstone | undefined>) => { selectedMarker = apply(selectedMarker, update); },
      refreshDetails: () => { refreshes++; },
    };
    await createMarkerMutations(context).createHeadstoneForGrave(grave!, { latitude: "40", longitude: "-80" } as SaveHeadstoneCreateInput);
    await createOwnershipMutations(context).saveGraveLot("new-lot");
    await createEvidenceMutations(context).deleteSavedGraveFeature("remove");
    const media = createMediaMutations(context);
    await media.deletePhoto("remove");
    await media.movePhoto({ id: "second", mediaLinkId: "second-link", mediaLinkType: "gravesite" }, "earlier");
    return { data, grave, selected, refreshes };
  }, { initial: detail("A-TEST"), other: detail("B-TEST") });
  expect(result.refreshes).toBe(0);
  expect(result.data.headstones).toHaveLength(1);
  expect(result.data.headstones[0].geometry).toEqual({ type: "Point", coordinates: [-80, 40] });
  expect(result.grave!.headstones.map((stone) => stone.id)).toEqual([marker.id]);
  expect(result.data.graves.map((grave) => grave.lot)).toEqual(["new-lot", ""]);
  expect(result.selected!.lot).toBe("new-lot");
  expect(result.grave!.lot).toBe("new-lot");
  expect(result.grave!.features.map((feature) => feature.id)).toEqual(["keep"]);
  expect(result.grave!.mediaAssets.map((asset) => asset.id)).toEqual(["second", "first"]);
  expect(requests).toHaveLength(5);
  expect(requests.every((request) => !request.startsWith("GET "))).toBe(true);
});

test("failed deletion preserves local records", async ({ page }) => {
  await fixture(page);
  await page.goto("/");
  await page.route("**/api/grave-features/keep", (route) => route.fulfill({ status: 500, json: {} }));
  const result = await page.evaluate(async (initial) => {
    const { createEvidenceMutations } = await import("/src/hooks/evidenceMutations.ts");
    let updates = 0;
    const mutations = createEvidenceMutations({ selectedGrave: initial as GraveSpace, setSelectedGraveDetails: () => { updates++; }, setSelectedHeadstoneDetails: () => { updates++; }, setData: () => {}, setSelectedGrave: () => {}, refreshDetails: () => {} });
    try { await mutations.deleteSavedGraveFeature("keep"); return { failed: false, updates }; }
    catch { return { failed: true, updates }; }
  }, detail("A-TEST"));
  expect(result).toEqual({ failed: true, updates: 0 });
});
