import { expect, type Page } from "@playwright/test";
export const cemeteryId = "11111111-1111-4111-8111-111111111111";
export const geometry = { type: "Polygon", coordinates: [[[-80.001,39.999],[-79.999,39.999],[-79.999,40.001],[-80.001,40.001],[-80.001,39.999]]] };
export const summaries = ["A-TEST", "B-TEST"].map((id) => ({ id, cemeteryId, cemeteryName: "Test Cemetery", section: "A", space: id, lot: "", status: "available", geometry }));
export const detail = (id: string, version = "1", name = id) => ({ ...summaries.find((grave) => grave.id === id), name, version, owners: [], currentOwnerIds: [], burials: [], headstones: [], features: [], maintenanceRecords: [], northHillsEvidence: [], mediaAssets: [], ownershipHistory: [] });
export const gravePath = (id: string) => `**/api/cemeteries/${cemeteryId}/grave-spaces/${id}`;
export async function fixture(page: Page) {
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: { canManageUsers: true, canOpenAdminPanel: true, canViewOwnership: true, canUpdateGravesites: true } } }));
  await page.route("**/api/headstone-lookups", (route) => route.fulfill({ status: 503, json: {} }));
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: { boundaries: [{ type: "Feature", properties: { name: "Test Cemetery" }, geometry }], sections: [], lots: [], graves: summaries, headstones: [] } }));
  await page.route("**/api/search**", (route) => route.fulfill({ json: summaries.map((grave) => ({ grave, reasons: [grave.id] })) }));
  for (const grave of summaries) await page.route(gravePath(grave.id), (route) => route.fulfill({ json: detail(grave.id) }));
}
export async function select(page: Page, id: string) {
  await page.getByLabel("Search cemetery records").fill(id);
  await page.locator(".result-card").filter({ hasText: id }).first().click();
  await expect(page.locator(".detail-panel")).toContainText(`Record ID: ${id}`);
}

