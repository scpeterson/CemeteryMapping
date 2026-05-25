import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const scopedGravePath = (grave: { cemeteryId: string; id: string }) =>
  `/api/cemeteries/${encodeURIComponent(grave.cemeteryId)}/grave-spaces/${encodeURIComponent(grave.id)}`;
const mockBoundaryGeometry: TestGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-80.001, 39.999],
      [-79.999, 39.999],
      [-79.999, 40.001],
      [-80.001, 40.001],
      [-80.001, 39.999],
    ],
  ],
};
const mockGraveGeometry: TestGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-80.0002, 39.9998],
      [-79.9998, 39.9998],
      [-79.9998, 40.0002],
      [-80.0002, 40.0002],
      [-80.0002, 39.9998],
    ],
  ],
};

type TestGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type TestGraveSummary = {
  cemeteryId: string;
  cemeteryName: string;
  geometry: TestGeometry;
  id: string;
};

function geometryBounds(geometry: TestGeometry) {
  const rings = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
  const coordinates = rings.flat().filter(Boolean) as [number, number][];
  return coordinates.reduce(
    (bounds, [longitude, latitude]) => ({
      east: Math.max(bounds.east, longitude),
      north: Math.max(bounds.north, latitude),
      south: Math.min(bounds.south, latitude),
      west: Math.min(bounds.west, longitude),
    }),
    { east: -Infinity, north: -Infinity, south: Infinity, west: Infinity },
  );
}

function geometryCenter(geometry: TestGeometry) {
  const bounds = geometryBounds(geometry);
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: (bounds.east + bounds.west) / 2,
  };
}

test("burial notes show the corrected North Hills source name without import-only fragments", async ({ page }) => {
  const cemeteryId = "11111111-1111-4111-8111-111111111111";
  const graveSummary = {
    cemeteryId,
    cemeteryName: "Mock Cemetery",
    geometry: mockGraveGeometry,
    id: "A-TEST",
    lot: "",
    section: "A",
    space: "TEST",
    status: "occupied",
  };

  await page.route("**/api/cemetery-map", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        boundaries: [{ type: "Feature", properties: { name: "Mock Cemetery" }, geometry: mockBoundaryGeometry }],
        sections: [],
        lots: [],
        graves: [graveSummary],
      }),
    });
  });
  await page.route("**/api/search**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route(`**${scopedGravePath(graveSummary)}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...graveSummary,
        owners: [],
        currentOwnerIds: [],
        burials: [
          {
            id: "burial-1",
            person: { id: "person-1", firstName: "Mabel", lastName: "Stone" },
            notes:
              "Funeral home: Hill & Sons | Imported from headstone spreadsheet row 9. North Hills Guide section: B. Person column: 1. Family requested quiet service.",
          },
        ],
        ownershipHistory: [],
      }),
    });
  });

  await page.goto("/");

  await expect(page.locator(".detail-panel")).toContainText("Mabel Stone");
  await expect(page.locator(".burial-notes li")).toHaveText([
    "Funeral home: Hill & Sons",
    "North Hills Genealogists section: B",
    "Family requested quiet service",
  ]);
  await expect(page.locator(".detail-panel")).not.toContainText("North Hills Guide");
  await expect(page.locator(".detail-panel")).not.toContainText("North Hills Geneologists");
  await expect(page.locator(".detail-panel")).not.toContainText("Imported from headstone spreadsheet row");
  await expect(page.locator(".detail-panel")).not.toContainText("Person column:");
});

test("read-only users do not see owner or deed sections", async ({ page }) => {
  const cemeteryId = "11111111-1111-4111-8111-111111111111";
  const graveSummary = {
    cemeteryId,
    cemeteryName: "Mock Cemetery",
    geometry: mockGraveGeometry,
    id: "A-TEST",
    lot: "1",
    section: "A",
    space: "TEST",
    status: "occupied",
  };

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        subject: "reader",
        email: "reader@example.test",
        role: "reader",
        permissions: {
          canViewOwnership: false,
          canManageUsers: false,
          canCreateCemeteryRecords: false,
          canUpdateCemeteryRecords: false,
          canDeleteCemeteryRecords: false,
        },
      }),
    });
  });
  await page.route("**/api/cemetery-map", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        boundaries: [{ type: "Feature", properties: { name: "Mock Cemetery" }, geometry: mockBoundaryGeometry }],
        sections: [],
        lots: [],
        graves: [graveSummary],
      }),
    });
  });
  await page.route("**/api/search**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route(`**${scopedGravePath(graveSummary)}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...graveSummary,
        owners: [{ id: "owner-1", displayName: "Hidden Owner", contactNote: "Deed 100" }],
        currentOwnerIds: ["owner-1"],
        burials: [{ id: "burial-1", person: { id: "person-1", firstName: "Mabel", lastName: "Stone" } }],
        ownershipHistory: [{ id: "event-1", ownerIds: ["owner-1"], eventType: "purchase", effectiveDate: "2020-01-01", recordedBy: "Deed book" }],
      }),
    });
  });

  await page.goto("/");

  await expect(page.locator(".detail-panel")).toContainText("Mabel Stone");
  await expect(page.locator(".detail-panel")).not.toContainText("Current Owner");
  await expect(page.locator(".detail-panel")).not.toContainText("Ownership Timeline");
  await expect(page.locator(".detail-panel")).not.toContainText("Hidden Owner");
  await expect(page.getByLabel("Open admin user management")).toHaveCount(0);
});

test("loads API-backed cemetery records and supports search", async ({ page }) => {
  const graveDetailRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/grave-spaces/")) graveDetailRequests.push(url.pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
  await expect(page.locator(".panel-heading .eyebrow")).toContainText(/\d+ cemeteries/);
  await expect(page.getByLabel("North arrow")).toBeVisible();
  await expect(page.getByLabel("Open admin user management")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fit all cemetery data" })).toBeVisible();
  await expect(page.getByLabel("Map scale")).toContainText(/Scale 1:[\d,]+/);
  await expect(page.getByLabel("Map scale")).toContainText(/0/);
  const initialScale = await page.getByLabel("Map scale").innerText();
  const mapBounds = await page.getByLabel("Interactive cemetery map").boundingBox();
  expect(mapBounds).not.toBeNull();
  await page.mouse.move(mapBounds!.x + mapBounds!.width / 2, mapBounds!.y + mapBounds!.height / 2);
  await page.mouse.wheel(0, -700);
  await expect.poll(() => page.getByLabel("Map scale").innerText()).not.toBe(initialScale);
  await expect(page.getByLabel("Map legend")).toContainText("Layers");
  await expect(page.getByLabel("Map legend")).toContainText("PASDA imagery");
  await expect(page.getByLabel("Map legend")).toContainText("Cemetery boundary");
  await expect(page.getByLabel("Map legend")).toContainText("Parcel boundary");
  await expect(page.getByLabel("Map legend")).toContainText("Lot polygon");
  await expect(page.getByLabel("Map legend")).toContainText("Gravesite Status");
  await expect(page.getByText(/\d+ results/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "A-01-01" })).toBeVisible();
  await expect(page.getByText("St. Mark Church Cemetery").first()).toBeVisible();
  const firstResult = page.locator(".result-card").first();
  await expect(page.locator(".result-card").filter({ hasText: "Reserved" }).first().locator(".result-meta")).toHaveCSS("color", "rgb(217, 164, 65)");
  await expect(firstResult.locator(".result-reason")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Loading grave details..." })).toBeHidden();
  await expect.poll(() => graveDetailRequests).toHaveLength(1);
  expect(graveDetailRequests[0]).toMatch(/^\/api\/cemeteries\/[0-9a-f-]+\/grave-spaces\/A-01-01$/);

  const mapResponse = await page.request.get("/api/cemetery-map");
  expect(mapResponse.ok()).toBe(true);
  const mapData = await mapResponse.json();
  expect(mapData.boundaries).toEqual(expect.any(Array));
  expect(mapData.boundaries.length).toBeGreaterThanOrEqual(2);
  expect(mapData.lots).toEqual(expect.any(Array));
  expect(mapData.lots.length).toBeGreaterThanOrEqual(5);
  expect(mapData.graves.length).toBeGreaterThanOrEqual(11);
  expect(mapData.lots[0]).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      section: expect.any(String),
      geometry: expect.any(Object),
    }),
  );
  expect(mapData.graves.map((grave: { id: string }) => grave.id)).toContain("A-01-01");
  expect(mapData.graves.filter((grave: { id: string }) => grave.id === "A-01-01")).toHaveLength(2);
  expect(new Set(mapData.graves.map((grave: { cemeteryId: string; id: string }) => `${grave.cemeteryId}:${grave.id}`)).size).toBe(mapData.graves.length);
  expect(mapData.graves[0]).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      cemeteryId: expect.any(String),
      cemeteryName: expect.any(String),
      geometry: expect.any(Object),
      status: expect.any(String),
    }),
  );
  expect(mapData.graves[0]).not.toHaveProperty("burials");
  expect(mapData.graves[0]).not.toHaveProperty("currentOwnerIds");
  expect(mapData.graves[0]).not.toHaveProperty("ownershipHistory");

  const memorialBoundary = mapData.boundaries.find((boundary: GeoJSON.Feature<TestGeometry, { name: string }>) => boundary.properties.name === "Memorial Grove Cemetery");
  const memorialA0101 = mapData.graves.find((grave: TestGraveSummary) => grave.cemeteryName === "Memorial Grove Cemetery" && grave.id === "A-01-01") as
    | TestGraveSummary
    | undefined;
  expect(memorialBoundary).toBeTruthy();
  expect(memorialA0101).toBeTruthy();

  await page.getByRole("button", { name: "Zoom to Memorial Grove Cemetery" }).click({ force: true });
  await page.waitForTimeout(450);

  const memorialMapBounds = await page.getByLabel("Interactive cemetery map").boundingBox();
  expect(memorialMapBounds).not.toBeNull();
  const boundaryBounds = geometryBounds(memorialBoundary.geometry);
  const graveCenter = geometryCenter(memorialA0101.geometry);
  const mapPadding = 110;
  const clickableWidth = memorialMapBounds!.width - mapPadding * 2;
  const clickableHeight = memorialMapBounds!.height - mapPadding * 2;
  await page.mouse.click(
    memorialMapBounds!.x + mapPadding + ((graveCenter.longitude - boundaryBounds.west) / (boundaryBounds.east - boundaryBounds.west)) * clickableWidth,
    memorialMapBounds!.y + mapPadding + ((boundaryBounds.north - graveCenter.latitude) / (boundaryBounds.north - boundaryBounds.south)) * clickableHeight,
  );
  await expect(page.getByRole("heading", { name: "A-01-01" })).toBeVisible();
  await expect(page.locator(".detail-panel")).toContainText("Memorial Grove Cemetery");
  await expect(page.locator(".detail-panel")).toContainText("Helen Rivera");
  await expect(page.locator(".detail-panel")).toContainText("Memorial Grove burial sharing a grave identifier");
  await expect(page.locator(".detail-panel")).not.toContainText("Imported from headstone spreadsheet row");
  await expect(page.locator(".detail-panel")).not.toContainText("Person column:");
  await expect.poll(() => graveDetailRequests.at(-1)).toContain(`/cemeteries/${memorialA0101.cemeteryId}/grave-spaces/A-01-01`);

  await page.getByLabel("Search cemetery records").fill("Garcia");
  await expect(page.getByText(/\d+ results/)).toBeVisible();
  await expect(page.getByText("Owner: Garcia Family").first()).toBeVisible();
  await expect(page.locator(".result-card").filter({ hasText: "St. Mark Church Cemetery" }).first()).toBeVisible();

  const response = await page.request.get("/api/search?q=Garcia");
  expect(response.ok()).toBe(true);
  const matches = (await response.json()) as unknown[];
  expect(matches.length).toBeGreaterThanOrEqual(2);
  expect(matches[0]).toHaveProperty("grave.geometry");
  expect(matches[0]).not.toHaveProperty("grave.burials");

  await page.getByText("Owner: Garcia Family").first().click();
  await expect.poll(() => graveDetailRequests.at(-1)).toContain("/grave-spaces/");

  const stMarkA0101 = mapData.graves.find((grave: { cemeteryName: string; id: string }) => grave.cemeteryName === "St. Mark Church Cemetery" && grave.id === "A-01-01");
  expect(stMarkA0101).toBeTruthy();
  const detailResponse = await page.request.get(scopedGravePath(stMarkA0101));
  expect(detailResponse.ok()).toBe(true);
  const grave = await detailResponse.json();
  expect(grave).toEqual(
    expect.objectContaining({
      id: "A-01-01",
      cemeteryId: stMarkA0101.cemeteryId,
      burials: expect.any(Array),
      currentOwnerIds: expect.any(Array),
      ownershipHistory: expect.any(Array),
      owners: expect.any(Array),
    }),
  );
});

test("admin soft delete hides a grave space from reads and restore makes it visible again", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/\d+ results/)).toBeVisible();

  const mapResponse = await page.request.get("/api/cemetery-map");
  const mapData = await mapResponse.json();
  const graveToDelete = mapData.graves.find((grave: { cemeteryName: string; id: string }) => grave.cemeteryName === "St. Mark Church Cemetery" && grave.id === "A-01-02");
  expect(graveToDelete).toBeTruthy();

  const deleteResponse = await page.request.delete(scopedGravePath(graveToDelete), {
    data: { reason: "Playwright soft delete test" },
  });
  expect(deleteResponse.ok()).toBe(true);
  const deleteResult = await deleteResponse.json();
  expect(deleteResult).toEqual(
    expect.objectContaining({
      graveSpaceId: "A-01-02",
      cemeteryId: graveToDelete.cemeteryId,
      auditEventId: expect.any(String),
      alreadyDeleted: false,
    }),
  );

  const deletedDetailResponse = await page.request.get(scopedGravePath(graveToDelete));
  expect(deletedDetailResponse.status()).toBe(404);

  const deletedMapResponse = await page.request.get("/api/cemetery-map");
  expect(deletedMapResponse.ok()).toBe(true);
  const deletedMapData = await deletedMapResponse.json();
  expect(deletedMapData.graves.map((grave: { cemeteryId: string; id: string }) => `${grave.cemeteryId}:${grave.id}`)).not.toContain(
    `${graveToDelete.cemeteryId}:A-01-02`,
  );

  const restoreResponse = await page.request.post(`${scopedGravePath(graveToDelete)}/restore`, {
    data: { reason: "Playwright restore test" },
  });
  expect(restoreResponse.ok()).toBe(true);
  const restoreResult = await restoreResponse.json();
  expect(restoreResult).toEqual(
    expect.objectContaining({
      graveSpaceId: "A-01-02",
      cemeteryId: graveToDelete.cemeteryId,
      auditEventId: expect.any(String),
      alreadyActive: false,
      restored: true,
    }),
  );

  const restoredDetailResponse = await page.request.get(scopedGravePath(graveToDelete));
  expect(restoredDetailResponse.ok()).toBe(true);
  const restoredMapResponse = await page.request.get("/api/cemetery-map");
  const restoredMapData = await restoredMapResponse.json();
  expect(restoredMapData.graves.map((grave: { cemeteryId: string; id: string }) => `${grave.cemeteryId}:${grave.id}`)).toContain(
    `${graveToDelete.cemeteryId}:A-01-02`,
  );
});
