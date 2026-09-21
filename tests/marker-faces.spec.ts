import { expect, test } from "@playwright/test";
import { select, cemeteryId } from "./fixtures/cemetery";
import { marker, overviewFixture } from "./fixtures/overview";
import type { MarkerFace } from "../src/types";

test("edit and reload multiple faces with multiline text, people, photos and conflict recovery", async ({ page }, testInfo) => {
  await overviewFixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: { canManageUsers: true, canOpenAdminPanel: true, canViewOwnership: true, canUpdateGravesites: true, canDeletePhotos: true } } }));
  let current = { ...marker, mediaAssets: marker.mediaAssets.map((asset) => ({ ...asset, mediaLinkId: asset.id, isPrimary: asset.id === "latest-marker" })), facesRevision: 0, facePeople: [{ id: "alice", fullName: "Alice Example" }, { id: "bob", fullName: "Bob Example" }],
    faces: [{ id: "11111111-1111-4111-8111-111111111112", label: "Unspecified face", inscription: "Family marker", notes: "", burialIds: [], mediaAssetIds: [] }] as MarkerFace[] };
  let conflict = false;
  await page.route("**/api/headstone-lookups", (route) => route.fulfill({ json: {
    markerTypes: [marker.markerType], markerScopes: [marker.markerScope], materials: [marker.material], conditions: [marker.condition],
  } }));
  await page.route("**/api/headstones/marker-1", async (route) => {
    if (route.request().method() === "PATCH") {
      if (conflict) return route.fulfill({ status: 409, json: { error: "Marker faces changed since you opened the editor. Reload the marker before saving." } });
      const payload = route.request().postDataJSON();
      expect(payload.facesRevision).toBe(current.facesRevision);
      current = { ...current, faces: payload.faces, facesRevision: current.facesRevision + 1 };
    }
    await route.fulfill({ json: current });
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.getByRole("region", { name: "Unspecified face", exact: true })).toContainText("Family marker");
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await page.getByRole("button", { name: "Manage faces", exact: true }).click();
  const first = page.getByRole("group", { name: "Face 1", exact: true });
  await first.getByLabel("Face label", { exact: true }).fill("North");
  await first.getByRole("textbox", { name: "Inscription", exact: true }).fill("  ALICE\n1901–1981  ");
  await first.getByLabel("Alice Example", { exact: true }).check();
  await first.getByLabel("latest-marker.png", { exact: true }).check();
  await page.getByRole("button", { name: "Add face", exact: true }).click();
  const second = page.getByRole("group", { name: "Face 2", exact: true });
  await second.getByLabel("Face label", { exact: true }).fill("Base");
  await second.getByRole("textbox", { name: "Inscription", exact: true }).fill("Family\nMemorial");
  await second.getByRole("textbox", { name: "Face notes", exact: true }).fill("Last word weathered");
  await second.getByLabel("Alice Example", { exact: true }).check();
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  const north = page.getByRole("region", { name: "North", exact: true });
  await expect(north).toContainText("Alice Example");
  await expect(north.locator(".inscription-box")).toHaveText("  ALICE\n1901–1981  ", { useInnerText: false });
  await expect(north.getByRole("img")).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Details", exact: true }).getByRole("img", { name: "latest-marker", exact: true })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Base", exact: true })).toContainText("Last word weathered");
  await expect(north.getByRole("button", { name: "Delete photo latest-marker.png", exact: true })).toBeVisible();
  await expect(north.getByRole("button", { name: "Remove primary: latest-marker.png", exact: true })).toBeVisible();
  expect(current.faces[0].inscription).toBe("  ALICE\n1901–1981  ");
  await north.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("marker-faces.png"), fullPage: true });
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await first.scrollIntoViewIfNeeded();
  await expect(first).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("marker-faces-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await first.getByRole("textbox", { name: "Face notes", exact: true }).fill("Unsaved change");
  conflict = true;
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Reload the marker");
  await expect(first.getByRole("textbox", { name: "Face notes", exact: true })).toHaveValue("Unsaved change");
  conflict = false;
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await select(page, "A-TEST");
  await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(north).toContainText("Alice Example");
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await second.getByRole("button", { name: "Remove face" }).click();
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  expect(current.faces).toHaveLength(1);
  expect(current.facePeople).toHaveLength(2);
  expect(current.mediaAssets).toHaveLength(2);
});

test("read-only users can read face inscriptions and photos without edit controls", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { role: "reader", assignedCemeteryIds: [cemeteryId], permissions: {} } }));
  await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: { ...marker, facesRevision: 1,
    facePeople: [{ id: "alice", fullName: "Alice Example" }], faces: [{ id: "north", label: "North", inscription: "Alice\nExample", notes: "Weathered",
      burialIds: ["alice"], mediaAssetIds: ["latest-marker"] }] } }));
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  const north = page.getByRole("region", { name: "North", exact: true });
  await expect(north).toContainText("Alice Example");
  await expect(north.getByRole("img")).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Details", exact: true }).getByRole("img", { name: "latest-marker", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Edit marker HS-OVERVIEW" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add face", exact: true })).toHaveCount(0);
});

test("a marker without an inscription supports ordinary inscription and back text entry", async ({ page }) => {
  await overviewFixture(page);
  let current = { ...marker, inscription: "", backDescription: "", faces: [] as MarkerFace[], facesRevision: 0 };
  await page.route("**/api/headstone-lookups", (route) => route.fulfill({ json: {
    markerTypes: [marker.markerType], markerScopes: [marker.markerScope], materials: [marker.material], conditions: [marker.condition],
  } }));
  await page.route("**/api/headstones/marker-1", async (route) => {
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON();
      current = { ...current, faces: payload.faces, backDescription: payload.backDescription, facesRevision: current.facesRevision + 1 };
    }
    await route.fulfill({ json: current });
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await expect(page.getByRole("textbox", { name: "Inscription", exact: true })).toBeVisible();
  await expect(page.getByLabel("Face label", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  expect(current.faces).toEqual([]);
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await page.getByRole("textbox", { name: "Inscription", exact: true }).fill("MYRTLE\nDEER");
  await page.getByRole("textbox", { name: "Back of stone", exact: true }).fill("Family memorial");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  expect(current.faces).toHaveLength(1);
  expect(current.faces[0]).toMatchObject({ label: "Unspecified face", inscription: "MYRTLE\nDEER", burialIds: [], mediaAssetIds: [] });
  expect(current.backDescription).toBe("Family memorial");
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await expect(page.getByRole("textbox", { name: "Inscription", exact: true })).toHaveValue("MYRTLE\nDEER");
  await expect(page.getByRole("textbox", { name: "Back of stone", exact: true })).toHaveValue("Family memorial");
});


test("saving ignores empty new faces but requires labels for faces with content", async ({ page }) => {
  await overviewFixture(page);
  let current = { ...marker, facesRevision: 0, faces: [] as MarkerFace[] };
  let saves = 0;
  await page.route("**/api/headstone-lookups", (route) => route.fulfill({ json: {
    markerTypes: [marker.markerType], markerScopes: [marker.markerScope], materials: [marker.material], conditions: [marker.condition],
  } }));
  await page.route("**/api/headstones/marker-1", async (route) => {
    if (route.request().method() === "PATCH") {
      saves++;
      current = { ...current, faces: route.request().postDataJSON().faces, facesRevision: current.facesRevision + 1 };
    }
    await route.fulfill({ json: current });
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await page.getByRole("button", { name: "Manage faces", exact: true }).click();
  await page.getByRole("button", { name: "Add face", exact: true }).click();
  const first = page.getByRole("group", { name: "Face 1", exact: true });
  await first.getByLabel("Face label", { exact: true }).fill("Front");
  await first.getByRole("textbox", { name: "Inscription", exact: true }).fill("MYRTLE");
  await page.getByRole("button", { name: "Add face", exact: true }).click();
  expect(saves).toBe(0);
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("region", { name: "Front", exact: true })).toContainText("MYRTLE");
  expect(saves).toBe(1);
  expect(current.faces).toHaveLength(1);
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await page.getByRole("button", { name: "Add face", exact: true }).click();
  const second = page.getByRole("group", { name: "Face 2", exact: true });
  await second.getByRole("textbox", { name: "Inscription", exact: true }).fill("DEER");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  expect(await second.getByLabel("Face label", { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect(saves).toBe(1);
  await second.getByLabel("Face label", { exact: true }).fill("Back");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("region", { name: "Back", exact: true })).toContainText("DEER");
  expect(current.faces).toHaveLength(2);
});
