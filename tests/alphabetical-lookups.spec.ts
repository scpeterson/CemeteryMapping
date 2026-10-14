import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

test("Admin alphabetizes new and renamed lookup values without sort controls", async ({ page }) => {
  await fixture(page);
  const row = (id: string, label: string) => ({ id, code: id, label, description: "Material", isActive: true, usageCount: 0, usageLabel: "headstones", createdAt: "", updatedAt: "" });
  await page.route("**/api/admin/lookups", route => route.fulfill({ json: {
    tables: [{ table: "marker_material_types", label: "Marker materials", hasSourceFields: true }],
    lookups: { marker_material_types: [row("zinc", "Zinc"), row("granite", "Granite, gray")] },
  } }));
  await page.route("**/api/admin/lookups/marker_material_types**", route => {
    const body = route.request().postDataJSON();
    expect(body.sortOrder).toBeUndefined();
    return route.fulfill({ json: { ...row(body.code, body.label), ...body, id: route.request().method() === "PUT" ? "zinc" : "bronze" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Lookups", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
  const labels = admin.locator(".lookup-row-list .lookup-label input");
  await expect.poll(() => labels.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(["Granite, gray", "Zinc"]);
  await expect(admin.locator(".lookup-sort")).toHaveCount(0);
  await expect(admin.getByRole("button", { name: /^Move .* (up|down)$/ })).toHaveCount(0);
  const newRow = admin.locator(".lookup-row-new");
  await newRow.getByLabel("Label", { exact: true }).fill("Bronze");
  await newRow.getByLabel("Description", { exact: true }).fill("Material");
  await newRow.getByRole("button", { name: "Add value", exact: true }).click();
  await expect.poll(() => labels.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(["Bronze", "Granite, gray", "Zinc"]);
  const zinc = admin.locator(".lookup-row-list .lookup-row").nth(2);
  await zinc.getByLabel("Label", { exact: true }).fill("Aluminum");
  await zinc.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => labels.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(["Aluminum", "Bronze", "Granite, gray"]);
});
