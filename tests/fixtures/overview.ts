import type { Page } from "@playwright/test";
import { cemeteryId, detail, fixture, geometry, gravePath, summaries } from "./cemetery";

const lookup = { id: "flat", code: "flat", label: "Flat marker" };
const photo = (id: string, capturedAt: string) => ({
  id, cemeteryId, assetType: "photo", fileUrl: `/media/${id}.png`, originalFilename: `${id}.png`,
  notes: id, capturedAt, uploadedAt: "2026-09-01", displayOrder: 0,
});
const person = (id: string, firstName: string, lastName: string) => ({
  id, person: { id, firstName, lastName, birthDate: "1901-02-03", deathDate: "1981-04-05" }, veteran: false,
});
export const marker = {
  id: "marker-1", headstoneId: "HS-OVERVIEW", markerType: lookup, markerScope: lookup, material: lookup, condition: lookup,
  vaseNotes: "", conditionNotes: "", inscription: "Family marker", designNotes: "", backDescription: "", photoUrl: "",
  reviewNotes: "", sourceConflict: false, nhgInclusion: "not_checked", nhgInclusionRecorded: false,
  provenanceVerificationSource: "field_photo", relationshipType: "primary", relationshipNotes: "",
  associatedGravesiteIds: ["A-TEST", "B-TEST"], burialIds: ["alice", "bob"], northHillsEvidence: [], features: [],
  maintenanceRecords: [], relationships: [], gravesiteRelationships: [],
  mediaAssets: [photo("latest-marker", "2026-08-01"), photo("old-marker", "2020-01-01")],
};
export const markerSummary = {
  id: marker.id, headstoneId: marker.headstoneId, cemeteryId, cemeteryName: "Test Cemetery", gravesiteId: "A-TEST",
  graveKey: "A-TEST", label: "Family marker", markerTypeCode: "flat", markerType: "Flat marker", markerScopeCode: "couple",
  markerScope: "Couple", condition: "Good", geometry: { type: "Point", coordinates: [-80, 40] },
};
export const overviewGrave = (id: string) => ({
  ...detail(id), status: "occupied", headstones: [marker],
  burials: id === "A-TEST" ? [person("alice", "Alice", "Example"), person("unrelated", "Unrelated", "Burial")] : [person("bob", "Bob", "Example")],
  currentOwnerIds: [`owner-${id}`], owners: [{ id: `owner-${id}`, displayName: `Owner ${id}`, firstName: "Owner", lastName: id }],
  mediaAssets: [photo("older-grave", "2025-01-01")],
});

export async function overviewFixture(page: Page) {
  await fixture(page);
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: {
    boundaries: [{ type: "Feature", properties: { name: "Test Cemetery" }, geometry }],
    sections: [], lots: [], graves: summaries, headstones: [markerSummary],
  } }));
  await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: marker }));
  for (const grave of summaries) await page.route(gravePath(grave.id), (route) => route.fulfill({ json: overviewGrave(grave.id) }));
  await page.route("**/media/*.png", (route) => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=", "base64") }));
}
