import { expect, test, type Page } from "@playwright/test";

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

async function selectResultGrave(page: Page, graveId: string) {
  await page.getByLabel("Search cemetery records").fill(graveId);
  await page.locator(".result-card").filter({ hasText: graveId }).first().click();
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
        headstones: [],
      }),
    });
  });
  await page.route("**/api/search**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([{ grave: graveSummary, reasons: [`Grave: ${graveSummary.id}`] }]) });
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
            veteran: true,
            militaryBranchCode: "army",
            militaryBranch: "U.S. Army",
            militaryWarServiceCode: "world_war_ii",
            militaryWars: "World War II",
            notes:
              "Funeral home: Hill & Sons | Imported from headstone spreadsheet row 9. North Hills Guide section: B. Person column: 1. Family requested quiet service.",
          },
        ],
        ownershipHistory: [],
      }),
    });
  });

  await page.goto("/");
  await selectResultGrave(page, "A-TEST");

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
          canOpenAdminPanel: false,
          canCreateCemeteryRecords: false,
          canUpdateCemeteryRecords: false,
          canUpdateHeadstones: false,
          canDeleteCemeteryRecords: false,
        },
        assignedCemeteryIds: [],
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
        headstones: [],
      }),
    });
  });
  await page.route("**/api/search**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([{ grave: graveSummary, reasons: [`Grave: ${graveSummary.id}`] }]) });
  });
  await page.route(`**${scopedGravePath(graveSummary)}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...graveSummary,
        owners: [{ id: "owner-1", displayName: "Hidden Owner", contactNote: "Deed 100" }],
        currentOwnerIds: ["owner-1"],
        burials: [{ id: "burial-1", person: { id: "person-1", firstName: "Mabel", lastName: "Stone" }, veteran: false }],
        headstones: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            headstoneId: "HS-1",
            markerType: { id: "44444444-4444-4444-8444-444444444444", code: "upright_headstone", label: "Upright headstone" },
            material: { id: "55555555-5555-4555-8555-555555555555", code: "granite", label: "Granite" },
            condition: { id: "66666666-6666-4666-8666-666666666666", code: "good", label: "Good" },
            conditionNotes: "Stable and legible",
            inscription: "Beloved family marker",
            designNotes: "Carved roses above the name",
            backDescription: "Back side lists children",
            photoUrl: "",
            lastInspectedAt: "2026-05-28",
            relationshipType: "spans",
            relationshipNotes: "Shared by adjacent gravesites",
            burialIds: ["burial-1"],
          },
        ],
        ownershipHistory: [{ id: "event-1", ownerIds: ["owner-1"], eventType: "purchase", effectiveDate: "2020-01-01", recordedBy: "Deed book" }],
      }),
    });
  });

  await page.goto("/");
  await selectResultGrave(page, "A-TEST");

  await expect(page.locator(".detail-panel")).toContainText("Mabel Stone");
  await expect(page.locator(".detail-panel")).toContainText("Markers");
  await expect(page.locator(".detail-panel")).toContainText("Upright headstone");
  await expect(page.locator(".detail-panel")).toContainText("Granite");
  await expect(page.locator(".detail-panel")).toContainText("Good");
  await expect(page.locator(".detail-panel")).toContainText("Designs: Carved roses above the name");
  await expect(page.locator(".detail-panel")).toContainText("Back: Back side lists children");
  await expect(page.locator(".marker-relationship")).toContainText("Marker spans multiple gravesites (spans) - Shared by adjacent gravesites");
  await expect(page.locator(".marker-relationship")).toHaveAttribute(
    "title",
    "One physical marker or headstone is shared by this gravesite and at least one neighboring gravesite, such as a two-person headstone centered between burial spaces. Notes: Shared by adjacent gravesites",
  );
  await expect(page.getByLabel("Edit marker HS-1")).toHaveCount(0);
  await expect(page.locator(".detail-panel")).not.toContainText("Current Owner");
  await expect(page.locator(".detail-panel")).not.toContainText("Ownership Timeline");
  await expect(page.locator(".detail-panel")).not.toContainText("Hidden Owner");
  await expect(page.getByRole("button", { name: /Open administration/u })).toHaveCount(0);
});

test("power users can edit headstone marker details from grave detail", async ({ page }) => {
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
  const headstone = {
    id: "33333333-3333-4333-8333-333333333333",
    headstoneId: "HS-1",
    markerType: { id: "44444444-4444-4444-8444-444444444444", code: "upright_headstone", label: "Upright headstone" },
    material: { id: "55555555-5555-4555-8555-555555555555", code: "granite", label: "Granite" },
    condition: { id: "66666666-6666-4666-8666-666666666666", code: "good", label: "Good" },
    conditionNotes: "Stable and legible",
    inscription: "Beloved family marker",
    designNotes: "",
    backDescription: "",
    photoUrl: "",
    lastInspectedAt: "2026-05-28",
    relationshipType: "primary",
    relationshipNotes: "",
    burialIds: [],
  };

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        subject: "power-user",
        email: "power@example.test",
        role: "power-user",
        permissions: {
          canViewOwnership: true,
          canManageUsers: false,
          canOpenAdminPanel: true,
          canCreateCemeteryRecords: false,
          canUpdateCemeteryRecords: true,
          canUpdateHeadstones: true,
          canDeleteCemeteryRecords: false,
        },
        assignedCemeteryIds: [cemeteryId],
      }),
    });
  });
  await page.route("**/api/headstone-lookups", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        markerTypes: [
          { id: "44444444-4444-4444-8444-444444444444", code: "upright_headstone", label: "Upright headstone" },
          { id: "44444444-4444-4444-8444-444444444445", code: "flat_marker", label: "Flat marker" },
        ],
        materials: [
          { id: "55555555-5555-4555-8555-555555555555", code: "granite", label: "Granite" },
          { id: "55555555-5555-4555-8555-555555555556", code: "marble", label: "Marble" },
          { id: "55555555-5555-4555-8555-555555555557", code: "pink_granite", label: "Pink granite" },
        ],
        conditions: [
          { id: "66666666-6666-4666-8666-666666666666", code: "good", label: "Good" },
          { id: "66666666-6666-4666-8666-666666666667", code: "poor", label: "Poor" },
        ],
        vaseTypes: [],
        vaseMaterials: [],
        vasePlacements: [],
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
        headstones: [],
      }),
    });
  });
  await page.route("**/api/search**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([{ grave: graveSummary, reasons: [`Grave: ${graveSummary.id}`] }]) });
  });
  await page.route(`**${scopedGravePath(graveSummary)}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...graveSummary,
        owners: [],
        currentOwnerIds: [],
        burials: [],
        headstones: [headstone],
        ownershipHistory: [],
      }),
    });
  });
  await page.route("**/api/headstones/33333333-3333-4333-8333-333333333333", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    const body = route.request().postDataJSON() as { materialId: string; conditionId: string; conditionNotes: string; designNotes: string; backDescription: string };
    expect(body.materialId).toBe("55555555-5555-4555-8555-555555555557");
    expect(body.conditionId).toBe("66666666-6666-4666-8666-666666666667");
    expect(body.conditionNotes).toBe("Leaning and needs inspection");
    expect(body.designNotes).toBe("Etched ivy border");
    expect(body.backDescription).toBe("Veteran medallion attached on back");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...headstone,
        material: { id: "55555555-5555-4555-8555-555555555557", code: "pink_granite", label: "Pink granite" },
        condition: { id: "66666666-6666-4666-8666-666666666667", code: "poor", label: "Poor" },
        conditionNotes: "Leaning and needs inspection",
        designNotes: "Etched ivy border",
        backDescription: "Veteran medallion attached on back",
        auditEventId: "77777777-7777-4777-8777-777777777777",
      }),
    });
  });

  await page.goto("/");
  await selectResultGrave(page, "A-TEST");
  await page.getByLabel("Edit marker HS-1").click();
  await page.getByRole("combobox", { name: "Material", exact: true }).selectOption("55555555-5555-4555-8555-555555555557");
  await page.getByRole("combobox", { name: "Condition" }).selectOption("66666666-6666-4666-8666-666666666667");
  await page.getByRole("textbox", { name: "Condition notes" }).fill("Leaning and needs inspection");
  await page.getByRole("textbox", { name: "Flourishes or designs" }).fill("Etched ivy border");
  await page.getByRole("textbox", { name: "Back of stone" }).fill("Veteran medallion attached on back");
  await page.getByRole("button", { name: "Save marker" }).click();

  await expect(page.locator(".detail-panel")).toContainText("Pink granite");
  await expect(page.locator(".detail-panel")).toContainText("Poor");
  await expect(page.locator(".detail-panel")).toContainText("Leaning and needs inspection");
  await expect(page.locator(".detail-panel")).toContainText("Designs: Etched ivy border");
  await expect(page.locator(".detail-panel")).toContainText("Back: Veteran medallion attached on back");
});

test("section G marker edits are limited to flat markers", async ({ page }) => {
  const cemeteryId = "11111111-1111-4111-8111-111111111111";
  const graveSummary = {
    cemeteryId,
    cemeteryName: "Mock Cemetery",
    geometry: mockGraveGeometry,
    id: "G-47",
    lot: "",
    section: "G",
    space: "47",
    status: "occupied",
  };
  const headstone = {
    id: "33333333-3333-4333-8333-333333333333",
    headstoneId: "HS-G-47",
    markerType: { id: "44444444-4444-4444-8444-444444444444", code: "upright_headstone", label: "Upright headstone" },
    material: { id: "55555555-5555-4555-8555-555555555555", code: "granite", label: "Granite" },
    condition: { id: "66666666-6666-4666-8666-666666666666", code: "good", label: "Good" },
    conditionNotes: "",
    inscription: "",
    designNotes: "",
    backDescription: "",
    photoUrl: "",
    lastInspectedAt: "2026-05-28",
    relationshipType: "primary",
    relationshipNotes: "",
    burialIds: [],
  };

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        subject: "power-user",
        email: "power@example.test",
        role: "power-user",
        permissions: {
          canViewOwnership: true,
          canManageUsers: false,
          canOpenAdminPanel: true,
          canCreateCemeteryRecords: false,
          canUpdateCemeteryRecords: true,
          canUpdateHeadstones: true,
          canDeleteCemeteryRecords: false,
        },
        assignedCemeteryIds: [cemeteryId],
      }),
    });
  });
  await page.route("**/api/headstone-lookups", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        markerTypes: [
          { id: "44444444-4444-4444-8444-444444444444", code: "upright_headstone", label: "Upright headstone" },
          { id: "44444444-4444-4444-8444-444444444445", code: "flat_marker", label: "Flat marker" },
        ],
        materials: [{ id: "55555555-5555-4555-8555-555555555555", code: "granite", label: "Granite" }],
        conditions: [{ id: "66666666-6666-4666-8666-666666666666", code: "good", label: "Good" }],
        vaseTypes: [],
        vaseMaterials: [],
        vasePlacements: [],
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
        headstones: [],
      }),
    });
  });
  await page.route("**/api/search**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([{ grave: graveSummary, reasons: [`Grave: ${graveSummary.id}`] }]) });
  });
  await page.route(`**${scopedGravePath(graveSummary)}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...graveSummary,
        owners: [],
        currentOwnerIds: [],
        burials: [],
        headstones: [headstone],
        ownershipHistory: [],
      }),
    });
  });
  await page.route("**/api/headstones/33333333-3333-4333-8333-333333333333", async (route) => {
    const body = route.request().postDataJSON() as { markerTypeId: string };
    expect(body.markerTypeId).toBe("44444444-4444-4444-8444-444444444445");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...headstone,
        markerType: { id: "44444444-4444-4444-8444-444444444445", code: "flat_marker", label: "Flat marker" },
        auditEventId: "77777777-7777-4777-8777-777777777777",
      }),
    });
  });

  await page.goto("/");
  await selectResultGrave(page, "G-47");
  await page.getByLabel("Edit marker HS-G-47").click();

  const markerType = page.getByRole("combobox", { name: "Marker type" });
  await expect(markerType.locator("option")).toHaveCount(1);
  await expect(markerType.locator("option")).toHaveText("Flat marker");
  await expect(page.locator(".headstone-form")).toContainText("Section G allows only flat markers.");

  await page.getByRole("button", { name: "Save marker" }).click();

  await expect(page.locator(".detail-panel")).toContainText("Flat marker");
});

test("loads API-backed cemetery records and supports search", async ({ page }) => {
  const graveDetailRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/grave-spaces/")) graveDetailRequests.push(url.pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
  await expect(page.locator(".panel-heading .eyebrow")).toContainText(/Cemetery records|\d+ cemeteries/);
  await expect(page.getByLabel("North arrow")).toBeVisible();
  await expect(page.getByRole("button", { name: /Open administration/u })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fit all cemetery data" })).toBeVisible();
  await expect(page.getByLabel("Map scale")).toContainText(/Scale 1:[\d,]+/);
  await expect(page.getByLabel("Map scale")).toContainText(/0/);
  const initialScale = await page.getByLabel("Map scale").innerText();
  const mapBounds = await page.getByLabel("Interactive cemetery map").boundingBox();
  expect(mapBounds).not.toBeNull();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => page.getByLabel("Map scale").innerText()).not.toBe(initialScale);
  await expect(page.getByLabel("Map legend")).toContainText("Layers");
  await expect(page.getByLabel("Map legend")).toContainText("Cemetery boundary");
  await expect(page.getByLabel("Map legend")).toContainText("Parcel boundary");
  await expect(page.getByLabel("Map legend")).toContainText("Lot polygon");
  await expect(page.getByLabel("Map legend")).toContainText("Gravesite Status");
  await expect(page.getByLabel("Map legend")).toContainText("Headstone marker");
  await expect(page.getByText(/\d+ results/)).toBeVisible();
  const firstResult = page.locator(".result-card").first();
  await firstResult.click();
  await expect(page.getByRole("heading", { name: "A-01-01" })).toBeVisible();
  await expect(page.getByText("St. Mark Church Cemetery").first()).toBeVisible();
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
  expect(mapData.headstones).toEqual(expect.any(Array));
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

  const memorialDetailResponse = await page.request.get(scopedGravePath(memorialA0101));
  expect(memorialDetailResponse.ok()).toBe(true);
  const memorialDetail = await memorialDetailResponse.json();
  expect(memorialDetail.cemeteryName).toBe("Memorial Grove Cemetery");
  expect(memorialDetail.burials[0].person.firstName).toBe("Helen");
  expect(memorialDetail.burials[0].person.lastName).toBe("Rivera");
  expect(JSON.stringify(memorialDetail)).toContain("Memorial Grove burial sharing a grave identifier used by St. Mark");

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

test("admin can edit cemetery section alternate names", async ({ page }) => {
  await page.route("**/api/admin/audit-events**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "audit-1",
          occurredAt: "2026-05-26T14:00:00.000Z",
          action: "update",
          targetTable: "sections",
          targetRecordId: "section-b",
          actorEmail: "admin@example.test",
          actorRole: "admin",
          actorExternalSubject: "auth0|admin",
          actorDatabaseUser: "cemetery_app",
          actorSessionUser: "cemetery_app",
          source: "api",
          reason: "Correct section alias",
          changedFields: ["alternate_names"],
          previousValues: { alternate_names: ["OC"] },
          newValues: { alternate_names: ["OC", "Original Cemetery"] },
          metadata: {},
        },
      ]),
    });
  });
  await page.route("**/api/admin/deed-registry-review**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        batches: [
          {
            id: "batch-updated",
            cemeteryName: "Trinity Lutheran Church Cemetery",
            sourceName: "Trinity Cemetery Registry 2022 - Updated 2022 final importer",
            worksheetName: "Updated 2022",
            importedBy: "Scott Peterson",
            notes: "Reimport from merged main.",
            createdAt: "2026-05-27T12:46:57.728Z",
            entryCount: 258,
            reviewCount: 3,
            lowConfidenceCount: 46,
          },
        ],
        selectedBatchId: "batch-updated",
        summary: [{ ownershipScope: "section_g_gravesite", parseConfidence: "high", count: 18 }],
        comparison: null,
        removedOriginalEntries: [],
        entries: [
          {
            id: "entry-1",
            batchId: "batch-updated",
            sourceRowNumber: 236,
            rowType: "owner_record",
            ownerDisplayName: "Robert & Elizabeth Watenpool",
            rawLotText: "88",
            rawSectionText: "",
            rawRemarks: "Updated to show plot 88 based on investigation.",
            deedOnFile: "No",
            deedRegisterOnFile: "No",
            parsedSectionName: "",
            parsedSectionAlias: "",
            parsedLotNumbers: ["88"],
            parsedPlotNumbers: [],
            parsedGraveNumbers: [],
            ownershipScope: "whole_lot",
            parseConfidence: "review",
            parseNotes: ["Needs review before promotion."],
            status: "staged",
            allocationCount: 1,
            relatedInvestigationNotes: [
              {
                sourceRowNumber: 16,
                ownerDisplayName: "Robert & Elizabeth Watenpool",
                rawRemarks: "Margaret Watenpool Blackford is buried in Section NA plot 88.",
              },
            ],
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Open administration/u }).click();
  const adminSectionsNav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(adminSectionsNav.getByRole("button", { name: "Users" })).toBeVisible();

  await adminSectionsNav.getByRole("button", { name: "Records" }).click();
  await expect(page.getByRole("heading", { name: "Cemetery Records" })).toBeVisible();

  await page.getByRole("combobox", { name: "Cemetery" }).selectOption({ label: "St. Mark Church Cemetery" });
  await expect(page.getByRole("combobox", { name: "Section" })).toBeVisible();
  await page.getByRole("combobox", { name: "Section" }).selectOption({ label: "Section A" });
  await expect(page.getByRole("combobox", { name: "Lot" })).toBeVisible();
  await page.getByRole("combobox", { name: "Lot" }).selectOption({ index: 1 });
  const lotRow = page.locator(".record-editor-row").filter({ has: page.getByRole("heading", { name: "Lot" }) }).first();
  await expect(lotRow.getByLabel("Lot audit timestamps")).toContainText("Created");
  await expect(lotRow.getByLabel("Lot audit timestamps")).toContainText("Updated");
  await page.getByRole("combobox", { name: "Lot" }).click();
  await page.getByRole("combobox", { name: "Section" }).selectOption({ label: "Section B" });
  await expect(page.getByRole("combobox", { name: "Lot" })).toHaveValue("");

  const sectionRow = page.locator(".record-editor-row").filter({ has: page.getByLabel("Alternate names") }).first();
  await expect(sectionRow).toBeVisible();
  await expect(sectionRow).toContainText("Section");
  await expect(sectionRow.getByLabel("Name", { exact: true })).toHaveValue("B");
  await expect(sectionRow.getByLabel("Alternate names")).toHaveValue(/Original Cemetery/u);
  await expect(sectionRow.getByLabel("Notes")).toBeVisible();
  await expect(sectionRow.getByLabel("Section audit timestamps")).toContainText("Created");
  await expect(sectionRow.getByLabel("Section audit timestamps")).toContainText("Updated");

  await sectionRow.getByLabel("Alternate names").fill("OC\nOriginal Cemetery\nOld Churchyard");
  await sectionRow.getByLabel("Notes").fill("Section B admin note");
  await sectionRow.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Section B saved." })).toBeVisible();

  const recordsResponse = await page.request.get("/api/admin/cemetery-records");
  expect(recordsResponse.ok()).toBe(true);
  const records = await recordsResponse.json();
  expect(records.sections.some((item: { sectionId: string; alternateNames: string[] }) => item.sectionId === "B" && item.alternateNames.includes("Old Churchyard"))).toBe(true);
  expect(records.sections.some((item: { sectionId: string; notes: string }) => item.sectionId === "B" && item.notes === "Section B admin note")).toBe(true);

  await adminSectionsNav.getByRole("button", { name: "Audit" }).click();
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Audit events" })).toContainText("admin@example.test");
  await expect(page.getByRole("table", { name: "Audit events" })).toContainText("Updated");
  await expect(page.getByLabel("Selected audit event detail")).toContainText("alternate_names");
  await expect(page.getByLabel("Selected audit event detail")).toContainText("Original Cemetery");

  await adminSectionsNav.getByRole("button", { name: "Deeds" }).click();
  await expect(page.getByRole("heading", { name: "Deed Evidence" })).toBeVisible();
  await expect(page.getByLabel("Staged deed registry evidence")).toContainText("Robert & Elizabeth Watenpool");
  await expect(page.getByLabel("Staged deed registry evidence")).toContainText("Needs review before promotion.");
  await expect(page.getByLabel("Related investigation notes")).toContainText("Section NA plot 88");
});
