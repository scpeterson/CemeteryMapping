import { expect, test, type Page, type Route } from "@playwright/test";

const cemeteryId = "11111111-1111-4111-8111-111111111111";
const geometry = { type: "Polygon", coordinates: [[[-80.001,39.999],[-79.999,39.999],[-79.999,40.001],[-80.001,40.001],[-80.001,39.999]]] };
const summaries = ["A-TEST", "B-TEST"].map((id) => ({ id, cemeteryId, cemeteryName: "Test Cemetery", section: "A", space: id, lot: "", status: "available", geometry }));
const detail = (id: string, version = "1", name = id) => ({ ...summaries.find((grave) => grave.id === id), name, version, owners: [], currentOwnerIds: [], burials: [], headstones: [], features: [], maintenanceRecords: [], northHillsEvidence: [], mediaAssets: [], ownershipHistory: [] });
const gravePath = (id: string) => `**/api/cemeteries/${cemeteryId}/grave-spaces/${id}`;
async function fixture(page: Page) {
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: { canManageUsers: true, canOpenAdminPanel: true, canViewOwnership: true, canUpdateGravesites: true } } }));
  await page.route("**/api/headstone-lookups", (route) => route.fulfill({ status: 503, json: {} }));
  await page.route("**/api/cemetery-map", (route) => route.fulfill({ json: { boundaries: [{ type: "Feature", properties: { name: "Test Cemetery" }, geometry }], sections: [], lots: [], graves: summaries, headstones: [] } }));
  await page.route("**/api/search**", (route) => route.fulfill({ json: summaries.map((grave) => ({ grave, reasons: [grave.id] })) }));
  for (const grave of summaries) await page.route(gravePath(grave.id), (route) => route.fulfill({ json: detail(grave.id) }));
}
async function select(page: Page, id: string) {
  await page.getByLabel("Search cemetery records").fill(id);
  await page.locator(".result-card").filter({ hasText: id }).first().click();
  await expect(page.locator(".detail-panel")).toContainText(`Record ID: ${id}`);
}

test("a delayed save cannot reselect its original grave", async ({ page }) => {
  await fixture(page);
  let finishSave!: () => Promise<void>;
  let started!: () => void;
  const saveStarted = new Promise<void>((resolve) => { started = resolve; });
  await page.route(gravePath("A-TEST"), async (route: Route) => {
    if (route.request().method() !== "PATCH") return route.fulfill({ json: detail("A-TEST") });
    finishSave = () => route.fulfill({ json: detail("A-TEST", "2", "Saved A") });
    started();
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("button", { name: /Edit gravesite/ }).click();
  await page.locator(".grave-form").getByLabel("Name", { exact: true }).fill("Saved A");
  await page.getByRole("button", { name: "Save gravesite", exact: true }).click();
  await saveStarted;
  await select(page, "B-TEST");
  const completed = page.waitForResponse((response) => response.request().method() === "PATCH");
  await finishSave();
  await (await completed).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator(".detail-panel")).toContainText("Record ID: B-TEST");
  await expect(page.locator(".detail-panel")).not.toContainText("Saved A");
});

test("conflicting edits keep the draft until explicit reload and save the fresh version", async ({ page }) => {
  await fixture(page);
  let reads = 0;
  let storedName = "Other editor";
  let storedVersion = "2";
  const versions: string[] = [];
  await page.route(gravePath("A-TEST"), async (route) => {
    if (route.request().method() !== "PATCH") return route.fulfill({ json: detail("A-TEST", ++reads === 1 ? "1" : storedVersion, reads === 1 ? "Original" : storedName) });
    versions.push(route.request().postDataJSON().expectedVersion);
    if (versions.length === 1) return route.fulfill({ status: 409, json: { error: "Record changed. Reload latest values." } });
    storedName = "My reconciled edit";
    storedVersion = "3";
    return route.fulfill({ json: detail("A-TEST", storedVersion, storedName) });
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("button", { name: /Edit gravesite/ }).click();
  const name = page.locator(".grave-form").getByLabel("Name", { exact: true });
  await name.fill("My draft");
  await page.getByRole("button", { name: "Save gravesite", exact: true }).click();
  await expect(name).toHaveValue("My draft");
  await page.getByRole("button", { name: "Reload latest values (discard edits)" }).click();
  await expect(name).toHaveValue("Other editor");
  await name.fill("My reconciled edit");
  await page.getByRole("button", { name: "Save gravesite", exact: true }).click();
  await expect(page.locator(".detail-panel")).toContainText("My reconciled edit");
  expect(versions).toEqual(["1", "2"]);
});

test("the photo gallery uses authorized fetch and displays a browser object URL", async ({ page }) => {
  await fixture(page);
  const fileUrl = "/media/33333333-3333-4333-8333-333333333333.png";
  let authorization: string | undefined;
  await page.route(`**${fileUrl}`, async (route) => {
    authorization = route.request().headers().authorization;
    await route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII=", "base64") });
  });
  await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: {
    ...detail("A-TEST"), mediaAssets: [{ id: "33333333-3333-4333-8333-333333333333", fileUrl, uploadedAt: "2026-09-07T12:00:00Z", originalFilename: "Protected photo", notes: "Protected photo" }],
  } }));
  await page.goto("/");
  await page.evaluate(async () => {
    const api = await import("/src/api/apiClient.ts");
    api.setAccessTokenProvider(async () => "integration-test-token");
  });
  await select(page, "A-TEST");
  await page.getByRole("tab", { name: "Monuments and photos" }).click();
  const image = page.getByRole("img", { name: "Protected photo" });
  await expect(image).toHaveAttribute("src", /^blob:/);
  expect(authorization).toBe("Bearer integration-test-token");
  await expect(image.locator("..")).toHaveAttribute("href", /^blob:/);
});

test("marker reports load protected photos with authorization", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixture(page);
  const report = { id: "photos", title: "Marker photos", category: "Markers", requiredRole: "reader", parameters: [], examples: [], description: "Photos" };
  await page.route("**/api/reports", (route) => route.fulfill({ json: [report] }));
  await page.route("**/api/reports/run", (route) => route.fulfill({ json: {
    report, layout: "marker-burial-pages", generatedAt: "2026-09-07T12:00:00Z", columns: [], notes: [],
    rows: [{ marker_id: "TEST-PHOTO", marker_uuid: "test", burial_uuid: "test-burial", photo_url: "/media/report.png" }],
  } }));
  let authorization: string | undefined;
  await page.route("**/media/report.png", (route) => {
    authorization = route.request().headers().authorization;
    return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII=", "base64") });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    const api = await import("/src/api/apiClient.ts");
    api.setAccessTokenProvider(async () => "report-test-token");
  });
  await page.getByRole("button", { name: "Open reports: run saved cemetery reports and guided queries", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("img", { name: "Marker TEST-PHOTO", exact: true })).toHaveAttribute("src", /^blob:/);
  expect(authorization).toBe("Bearer report-test-token");
});

for (const width of [390, 1024, 1280]) {
  test(`map actions do not overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.route("**/api/reports", (route) => route.fulfill({ json: [] }));
    await page.goto("/");
    const buttons = page.locator(".map-toolbar button");
    await expect(buttons).toHaveCount(8);
    const boxes = await buttons.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].right).toBeLessThanOrEqual(width);
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top).toBe(false);
      }
    }
    await page.getByRole("button", { name: /^Open reports:/ }).click();
    await expect(page.getByRole("dialog", { name: "Reports", exact: true })).toBeVisible();
  });
}

test("dialogs contain keyboard focus and restore the opener on Escape", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/reports", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  const opener = page.getByRole("button", { name: /^Open reports:/ });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Reports", exact: true });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
