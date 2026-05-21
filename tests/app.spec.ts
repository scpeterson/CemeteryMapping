import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("loads API-backed cemetery records and supports search", async ({ page }) => {
  const graveDetailRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/grave-spaces/")) graveDetailRequests.push(url.pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fit all cemetery data" })).toBeVisible();
  await expect(page.getByText(/\d+ results/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "A-01-01" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Loading grave details..." })).toBeHidden();
  await expect.poll(() => graveDetailRequests).toEqual(["/api/grave-spaces/A-01-01"]);

  const mapResponse = await page.request.get("/api/cemetery-map");
  expect(mapResponse.ok()).toBe(true);
  const mapData = await mapResponse.json();
  expect(mapData.boundaries).toEqual(expect.any(Array));
  expect(mapData.boundaries.length).toBeGreaterThanOrEqual(1);
  expect(mapData.graves.length).toBeGreaterThanOrEqual(9);
  expect(mapData.graves.map((grave: { id: string }) => grave.id)).toContain("A-01-01");
  expect(mapData.graves[0]).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      geometry: expect.any(Object),
      status: expect.any(String),
    }),
  );
  expect(mapData.graves[0]).not.toHaveProperty("burials");
  expect(mapData.graves[0]).not.toHaveProperty("currentOwnerIds");
  expect(mapData.graves[0]).not.toHaveProperty("ownershipHistory");

  await page.getByLabel("Search cemetery records").fill("Garcia");
  await expect(page.getByText(/\d+ results/)).toBeVisible();
  await expect(page.getByText("Owner: Garcia Family").first()).toBeVisible();

  const response = await page.request.get("/api/search?q=Garcia");
  expect(response.ok()).toBe(true);
  const matches = (await response.json()) as unknown[];
  expect(matches.length).toBeGreaterThanOrEqual(2);
  expect(matches[0]).toHaveProperty("grave.geometry");
  expect(matches[0]).not.toHaveProperty("grave.burials");

  await page.getByText("Owner: Garcia Family").first().click();
  await expect.poll(() => graveDetailRequests.at(-1)).toContain("/api/grave-spaces/");

  const detailResponse = await page.request.get("/api/grave-spaces/A-01-01");
  expect(detailResponse.ok()).toBe(true);
  const grave = await detailResponse.json();
  expect(grave).toEqual(
    expect.objectContaining({
      id: "A-01-01",
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

  const deleteResponse = await page.request.delete("/api/grave-spaces/A-01-02", {
    data: { reason: "Playwright soft delete test" },
  });
  expect(deleteResponse.ok()).toBe(true);
  const deleteResult = await deleteResponse.json();
  expect(deleteResult).toEqual(
    expect.objectContaining({
      graveSpaceId: "A-01-02",
      auditEventId: expect.any(String),
      alreadyDeleted: false,
    }),
  );

  const deletedDetailResponse = await page.request.get("/api/grave-spaces/A-01-02");
  expect(deletedDetailResponse.status()).toBe(404);

  const deletedMapResponse = await page.request.get("/api/cemetery-map");
  expect(deletedMapResponse.ok()).toBe(true);
  const deletedMapData = await deletedMapResponse.json();
  expect(deletedMapData.graves.map((grave: { id: string }) => grave.id)).not.toContain("A-01-02");

  const restoreResponse = await page.request.post("/api/grave-spaces/A-01-02/restore", {
    data: { reason: "Playwright restore test" },
  });
  expect(restoreResponse.ok()).toBe(true);
  const restoreResult = await restoreResponse.json();
  expect(restoreResult).toEqual(
    expect.objectContaining({
      graveSpaceId: "A-01-02",
      auditEventId: expect.any(String),
      alreadyActive: false,
      restored: true,
    }),
  );

  const restoredDetailResponse = await page.request.get("/api/grave-spaces/A-01-02");
  expect(restoredDetailResponse.ok()).toBe(true);
  const restoredMapResponse = await page.request.get("/api/cemetery-map");
  const restoredMapData = await restoredMapResponse.json();
  expect(restoredMapData.graves.map((grave: { id: string }) => grave.id)).toContain("A-01-02");
});
