import { expect, test } from "@playwright/test";

test("loads API-backed cemetery records and supports search", async ({ page }) => {
  const graveDetailRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/grave-spaces/")) graveDetailRequests.push(url.pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cemetery Map" })).toBeVisible();
  await expect(page.getByText("9 results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "A-01-01" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Loading grave details..." })).toBeHidden();
  await expect.poll(() => graveDetailRequests).toEqual(["/api/grave-spaces/A-01-01"]);

  const mapResponse = await page.request.get("/api/cemetery-map");
  expect(mapResponse.ok()).toBe(true);
  const mapData = await mapResponse.json();
  expect(mapData.graves).toHaveLength(9);
  expect(mapData.graves[0]).toEqual(
    expect.objectContaining({
      id: "A-01-01",
      geometry: expect.any(Object),
      status: expect.any(String),
    }),
  );
  expect(mapData.graves[0]).not.toHaveProperty("burials");
  expect(mapData.graves[0]).not.toHaveProperty("currentOwnerIds");
  expect(mapData.graves[0]).not.toHaveProperty("ownershipHistory");

  await page.getByLabel("Search cemetery records").fill("Garcia");
  await expect(page.getByText("2 results")).toBeVisible();
  await expect(page.getByText("Owner: Garcia Family").first()).toBeVisible();

  const response = await page.request.get("/api/search?q=Garcia");
  expect(response.ok()).toBe(true);
  const matches = (await response.json()) as unknown[];
  expect(matches).toHaveLength(2);
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
