import { expect, test } from "@playwright/test";
import { fixture, showApplicationActions } from "./fixtures/cemetery";
import type { LookupRecord } from "../src/types";

const definitions = [
  { table: "grave_feature_types", label: "Grave feature types", hasSourceFields: false },
  { table: "grave_feature_subtypes", label: "Grave feature subtypes", hasSourceFields: false, hasGraveFeatureType: true },
  { table: "grave_feature_material_types", label: "Grave feature materials", hasSourceFields: false },
  { table: "grave_feature_placement_types", label: "Grave feature placements", hasSourceFields: false },
];
for (const width of [1280, 390]) test(`system admin maintains shared grave feature lookups at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.route(/^http:\/\/[^/]+\/api\//, route => route.fulfill({ status: 404, json: { error: "Outside lookup fixture" } }));
  await fixture(page);
  await page.route("**/api/admin/cemetery-records", route => route.fulfill({ json: { cemeteries: [], sections: [], lots: [] } }));
  let counter = 0, refreshes = 0;
  const records: Record<string, LookupRecord[]> = Object.fromEntries(definitions.map(d => [d.table, []]));
  await page.route("**/api/headstone-lookups*", route => { refreshes++; return route.fulfill({ json: {} }); });
  await page.route("**/api/admin/lookups", route => route.fulfill({ json: { tables: definitions, lookups: records } }));
  await page.route("**/api/admin/lookups/**", route => {
    const segments = new URL(route.request().url()).pathname.split("/");
    const table = segments[4], id = segments[5];
    const input = route.request().postDataJSON();
    if (table === "grave_feature_subtypes") expect(input.graveFeatureTypeId ?? null).toBe(id ? records[table].find(r => r.id === id)!.graveFeatureTypeId : input.label === "Other subtype" ? null : records.grave_feature_types[0].id);
    const row = { usageCount: 0, usageLabel: "grave features", createdAt: "", updatedAt: "", ...input, ...(table === "grave_feature_subtypes" ? { graveFeatureTypeId: input.graveFeatureTypeId ?? null } : {}), id: id ?? `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}` };
    records[table] = id ? records[table].map(r => r.id === id ? row : r) : [...records[table], row];
    return route.fulfill({ json: row });
  });
  await page.goto("/"); await showApplicationActions(page);
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Lookups", exact: true }).click();
  await expect(admin).toContainText("shared across all cemeteries");
  for (const definition of definitions) {
    await admin.getByRole("combobox", { name: "Lookup table", exact: true }).selectOption(definition.table);
    const newRow = admin.locator(".lookup-row-new");
    await newRow.getByLabel("Label", { exact: true }).fill(definition.label + " test");
    await newRow.getByRole("textbox", { name: "Description", exact: true }).fill("Shared controlled value");
    if (definition.hasGraveFeatureType) await newRow.getByLabel("Feature type", { exact: true }).selectOption(records.grave_feature_types[0].id);
    await newRow.getByRole("button", { name: "Add value", exact: true }).click();
    const saved = admin.locator(".lookup-row-list .lookup-row").first();
    await expect(saved.getByLabel("Label", { exact: true })).toHaveValue(definition.label + " test");
    if (definition.hasGraveFeatureType) {
      await expect(saved.getByLabel("Feature type", { exact: true })).toBeDisabled();
      await expect(saved.getByLabel("Feature type", { exact: true })).toHaveValue(records.grave_feature_types[0].id);
      await saved.scrollIntoViewIfNeeded();
      expect(await admin.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (width < 800) {
        const boxes = await saved.locator(":scope > *").evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
        for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
      }
      await page.screenshot({ path: testInfo.outputPath(`grave-feature-subtype-${width}.png`) });
    }
    await saved.getByRole("textbox", { name: "Description", exact: true }).fill("Updated shared description");
    await saved.getByRole("button", { name: "Save", exact: true }).click();
    await expect(admin).toContainText(definition.label + " test saved.");
    await admin.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(saved.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Updated shared description");
  }
  await admin.getByRole("combobox", { name: "Lookup table", exact: true }).selectOption("grave_feature_subtypes");
  const newRow = admin.locator(".lookup-row-new");
  await newRow.getByLabel("Feature type", { exact: true }).selectOption("");
  await newRow.getByLabel("Label", { exact: true }).fill("Other subtype");
  await newRow.getByRole("textbox", { name: "Description", exact: true }).fill("Applies to all feature types");
  await newRow.getByRole("button", { name: "Add value", exact: true }).click();
  const generic = admin.locator(".lookup-row-list .lookup-row").filter({ has: page.locator('input[value="Other subtype"]') });
  await expect(generic.getByLabel("Feature type", { exact: true })).toHaveValue("");
  await generic.getByLabel("Active", { exact: true }).uncheck();
  await generic.getByRole("button", { name: "Save", exact: true }).click();
  await expect(generic).toHaveCount(0);
  await admin.getByLabel("Show inactive", { exact: true }).check();
  await expect(generic.getByLabel("Active", { exact: true })).not.toBeChecked();
  await expect.poll(() => refreshes).toBeGreaterThan(4);
});

test("cemetery admins do not receive shared lookup maintenance", async ({ page }) => {
  await page.route(/^http:\/\/[^/]+\/api\//, route => route.fulfill({ status: 404, json: { error: "Outside lookup fixture" } }));
  await fixture(page);
  await page.route("**/api/admin/cemetery-records", route => route.fulfill({ json: { cemeteries: [], sections: [], lots: [] } }));
  await page.route("**/api/me", route => route.fulfill({ json: { role: "cemetery-admin", assignedCemeteryIds: [], permissions: { canOpenAdminPanel: true, canManageUsers: false } } }));
  await page.goto("/"); await showApplicationActions(page);
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  await expect(page.getByRole("dialog", { name: "Admin management" }).getByRole("button", { name: "Lookups", exact: true })).toHaveCount(0);
});

test("shared lookup text fields retain source metadata when editing and adding values", async ({ page }) => {
  await page.route(/^http:\/\/[^/]+\/api\//, route => route.fulfill({ status: 404, json: { error: "Outside lookup fixture" } }));
  await fixture(page);
  await page.route("**/api/admin/cemetery-records", route => route.fulfill({ json: { cemeteries: [], sections: [], lots: [] } }));
  const original: LookupRecord = { id: "11111111-1111-4111-8111-111111111111", code: "granite", label: "Granite", description: "Granite material", isActive: true, usageCount: 0, usageLabel: "headstones", sourceNotes: "Original source", sourceUrl: "https://example.test/original", createdAt: "", updatedAt: "" };
  let rows = [original];
  await page.route("**/api/admin/lookups", route => route.fulfill({ json: { tables: [{ table: "marker_material_types", label: "Marker materials", hasSourceFields: true }], lookups: { marker_material_types: rows } } }));
  await page.route("**/api/admin/lookups/marker_material_types**", route => {
    const body = route.request().postDataJSON();
    const created = route.request().method() === "POST";
    expect(body.sourceNotes).toBe(created ? "New source" : "Updated source");
    expect(body.sourceUrl).toBe(created ? "https://example.test/new" : "https://example.test/updated");
    const saved = { ...original, ...body, id: created ? "22222222-2222-4222-8222-222222222222" : original.id };
    rows = created ? [...rows, saved] : [saved];
    return route.fulfill({ json: saved });
  });
  await page.goto("/"); await showApplicationActions(page);
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Lookups", exact: true }).click();
  const existing = admin.locator(".lookup-row-list .lookup-row").first();
  await expect(existing.getByRole("textbox", { name: "Source notes", exact: true })).toHaveValue("Original source");
  await existing.getByRole("textbox", { name: "Source notes", exact: true }).fill("Updated source");
  await existing.getByRole("textbox", { name: "Source URL", exact: true }).fill("https://example.test/updated");
  await existing.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin).toContainText("Granite saved.");
  const added = admin.locator(".lookup-row-new");
  await added.getByRole("textbox", { name: "Label", exact: true }).fill("Marble");
  await added.getByRole("textbox", { name: "Description", exact: true }).fill("Marble material");
  await added.getByRole("textbox", { name: "Source notes", exact: true }).fill("New source");
  await added.getByRole("textbox", { name: "Source URL", exact: true }).fill("https://example.test/new");
  await added.getByRole("button", { name: "Add value", exact: true }).click();
  await expect(admin).toContainText("Marble added.");
  await expect(added.getByRole("textbox", { name: "Source notes", exact: true })).toHaveValue("");
  await admin.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(existing.getByRole("textbox", { name: "Source URL", exact: true })).toHaveValue("https://example.test/updated");
});
