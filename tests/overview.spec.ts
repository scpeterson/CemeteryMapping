import { expect, test } from "@playwright/test";
import { cemeteryId, detail, fixture, gravePath, select } from "./fixtures/cemetery";
import { marker, overviewFixture, overviewGrave } from "./fixtures/overview";

const overview = (page: import("@playwright/test").Page) => page.getByRole("tabpanel", { name: "Overview", exact: true });

test("gravesite Overview uses monument photos, people and owners without editing controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await overviewFixture(page);
  let token = "";
  await page.route("**/media/latest-marker.png", async (route) => {
    token = route.request().headers().authorization;
    await route.fallback();
  });
  await page.goto("/tests/auth.html");
  await select(page, "A-TEST");
  const panel = overview(page);
  await expect(panel).toContainText("Alice Example");
  await expect(panel).toContainText("Owner A-TEST");
  await expect(panel).toContainText("Occupied");
  await expect(panel.getByRole("img", { name: "latest-marker" })).toBeVisible();
  expect(token).toBe("Bearer fixture-token");
  await expect(panel.locator("input, select, textarea")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /Edit|Save|Delete|Upload/ })).toHaveCount(0);
  await panel.getByRole("button", { name: "Open latest photo" }).click();
  await expect(page.getByRole("dialog", { name: "Latest feature photo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel.getByRole("button", { name: "Open latest photo" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("grave-overview.png"), fullPage: true });
  await panel.getByRole("button", { name: "View burial records" }).click();
  await expect(page.getByRole("tab", { name: "People and ownership" })).toHaveAttribute("aria-selected", "true");
  await select(page, "A-TEST");
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Location and geometry" }).click();
  await expect(page.getByRole("button", { name: /Edit gravesite/ })).toBeVisible();
  await select(page, "B-TEST");
  await expect(overview(page)).toContainText("Bob Example");
  await expect(overview(page)).not.toContainText("Alice Example");
});

test("marker Overview groups linked people and owners and defaults after reselection", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await overviewFixture(page);
  await page.goto("/");
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  const panel = overview(page);
  await expect(panel).toContainText("Alice Example");
  await expect(panel).toContainText("Bob Example");
  await expect(panel).not.toContainText("Unrelated Burial");
  await expect(panel).toContainText("Owner A-TEST");
  await expect(panel).toContainText("Owner B-TEST");
  await expect(panel).toContainText("Owners of linked gravesites");
  await expect(panel.getByRole("img", { name: "latest-marker" })).toBeVisible();
  await expect(panel.locator("input, select, textarea")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit marker information HS-OVERVIEW" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("marker-overview.png"), fullPage: true });
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit marker information HS-OVERVIEW" })).toBeVisible();
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await panel.getByRole("region", { name: "Linked gravesites", exact: true }).getByRole("button", { name: "A-B-TEST", exact: true }).click();
  await expect(overview(page)).toContainText("Bob Example");
});

test("read-only users cannot see owners in either overview", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "reader", assignedCemeteryIds: [cemeteryId], permissions: {} } }));
  await page.goto("/");
  await select(page, "A-TEST");
  await expect(overview(page)).toContainText("Alice Example");
  await expect(overview(page)).not.toContainText("Owner A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(overview(page)).toContainText("Bob Example");
  await expect(overview(page)).not.toContainText("Owner B-TEST");
});

test("missing photos and people have explicit empty states on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await fixture(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Search", exact: true }).click();
  await select(page, "A-TEST");
  await expect(overview(page)).toContainText("No photo available.");
  await expect(overview(page)).toContainText("No burial recorded.");
  await expect(overview(page)).toContainText("No current ownership is recorded.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("failed linked records can retry without showing stale people after selection", async ({ page }) => {
  await overviewFixture(page);
  let fail = true;
  await page.route("**/api/headstones/marker-1/overview", (route) => fail ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.fulfill({ json: [overviewGrave("A-TEST"), overviewGrave("B-TEST")] }));
  await page.goto("/");
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(overview(page)).toContainText("Some linked gravesite details could not be loaded.");
  fail = false;
  await overview(page).getByRole("button", { name: "Retry linked records" }).click();
  await expect(overview(page)).toContainText("Bob Example");
  await page.route(gravePath("B-TEST"), (route) => route.fulfill({ json: detail("B-TEST") }));
  await select(page, "B-TEST");
  await expect(overview(page)).toContainText("No burial recorded.");
  await expect(overview(page)).not.toContainText("Alice Example");
});

test("legacy marker photo is used when there are no linked photo assets", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: { ...marker, mediaAssets: [], photoUrl: "/media/legacy.png" } }));
  await page.goto("/");
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(overview(page).getByRole("img", { name: "Marker HS-OVERVIEW" })).toBeVisible();
});

test("leaving a marker overview aborts its pending summary request", async ({ page }) => {
  await overviewFixture(page);
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      if (String(input).endsWith("/headstones/marker-1/overview") && options?.signal) {
        document.documentElement.dataset.overviewPending = "true";
        return new Promise<Response>((_resolve, reject) => {
          options.signal!.addEventListener("abort", () => {
            document.documentElement.dataset.overviewAborted = "true";
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }
      return originalFetch(input, options);
    };
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await overview(page).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-overview-pending", "true");
  await select(page, "A-TEST");
  await expect(page.locator("html")).toHaveAttribute("data-overview-aborted", "true");
  await expect(overview(page)).toContainText("Alice Example");
  await expect(overview(page)).not.toContainText("Some linked gravesite details could not be loaded");
});

for (const canManageExceptions of [false, true]) {
  test(`gravesite overview shows plot exceptions with admin editing ${canManageExceptions ? "enabled" : "hidden"}`, async ({ page }) => {
    await overviewFixture(page);
    const uuid = "55555555-5555-4555-8555-555555555555";
    let hasDeedDocument = false;
    await page.route(gravePath("A-TEST"), route => route.fulfill({ json: {
      ...overviewGrave("A-TEST"), uuid, canManageExceptions, canUploadDeeds: canManageExceptions, hasDeedDocument,
      locationPolicies: { casket_or_two_urns: true },
      approvedExceptions: { burial: { ashesOnly: 3, ashesWithCasket: 0 }, markerWidth: 36 },
    } }));
    await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/${uuid}/deeds`, route => route.fulfill({ json: [] }));
    await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/${uuid}/deeds?*`, route => {
      hasDeedDocument = true;
      return route.fulfill({ status: 201, json: { id: uuid, filename: "Deed.pdf" } });
    });
    const marker = { max_width_inches: 36, approval_reference: "Signed deed" };
    await page.route("**/api/admin/policies/gravesite-exceptions**", route => {
      if (route.request().method() === "GET") {
        return route.fulfill({ json: [{ id: uuid, plotId: "A-TEST", capacityEnforced: true, marker, burial: null }] });
      }
      expect(route.request().postDataJSON()).toMatchObject({
        cemeteryId, graveId: uuid, rule: "marker", expected: marker, markerWidth: 37, approval: "Updated approval",
      });
      return route.fulfill({ json: { max_width_inches: 37, approval_reference: "Updated approval" } });
    });
    await page.goto("/");
    await select(page, "A-TEST");
    const exceptions = overview(page).getByRole("region", { name: "Approved exceptions", exact: true });
    await expect(exceptions).toContainText("Up to 3 sets of ashes");
    await expect(exceptions).toContainText("36 inches");
    const deeds = overview(page).getByRole("region", { name: "Gravesite deeds" });
    await expect(deeds).toContainText("No deed available");
    const edit = exceptions.getByRole("button", { name: "Edit approved exceptions" });
    if (!canManageExceptions) {
      await expect(edit).toHaveCount(0);
      await expect(deeds.getByRole("button", { name: "Upload deed" })).toHaveCount(0);
      return;
    }
    await edit.click();
    await expect(deeds.getByRole("button", { name: "Upload deed" })).toBeEnabled();
    const burial = exceptions.getByRole("form", { name: "Burial capacity exception" });
    await expect(burial.getByLabel("Written approval reference")).toHaveAttribute("placeholder", "No deed available");
    const form = exceptions.getByRole("form", { name: "Flush marker width exception" });
    await expect(form.getByLabel("Written approval reference")).toHaveValue("Signed deed");
    await form.getByLabel("Maximum width (inches)").fill("37");
    await form.getByLabel("Written approval reference").fill("Updated approval");
    await form.getByRole("button", { name: "Update marker width exception" }).click();
    await expect(exceptions.getByRole("status")).toHaveText("Approved exception saved.");
    await expect(exceptions).toContainText("37 inches");
    await deeds.getByLabel("Deed PDF").setInputFiles({ name: "Deed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF") });
    await deeds.getByRole("button", { name: "Upload deed" }).click();
    await expect(deeds.getByRole("checkbox", { name: "Deed on file", exact: true })).toBeChecked();
    await page.getByRole("tab", { name: "People and ownership" }).click();
    await expect(page.getByRole("checkbox", { name: "Deed on file", exact: true }).first()).toBeChecked();
  });
}
