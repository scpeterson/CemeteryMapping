import { expect, test } from "@playwright/test";
import { overviewFixture } from "./fixtures/overview";
import { select } from "./fixtures/cemetery";

for (const target of ["marker", "gravesite"] as const) {
  test(`multiple ${target} photos continue after failure and retry only failed files`, async ({ page }) => {
    await overviewFixture(page);
    await page.route("**/api/me", route => route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: { canManageUsers: true, canOpenAdminPanel: true, canUpdateHeadstones: true, canUpdateGravesites: true } } }));
    const uploaded: string[] = [];
    let fail = true;
    await page.route("**/api/cemeteries/*/grave-spaces/*/media-assets?**", route => {
      const params = new URL(route.request().url()).searchParams;
      const name = params.get("filename")!;
      uploaded.push(name);
      expect(params.get("notes")).toBe("Field photos");
      expect(params.get("capturedAt")).toBe("2026-10-15");
      expect(params.get("headstoneId")).toBe(target === "marker" ? "marker-1" : null);
      if (name === "second.png" && fail) return route.fulfill({ status: 500, json: { error: "Temporary upload failure" } });
      return route.fulfill({ json: { id: name, assetType: "photo", fileUrl: `/media/${name}` } });
    });
    await page.goto("/");
    await select(page, "A-TEST");
    await page.getByRole("tab", { name: "Monuments and photos" }).click();
    const forms = page.locator(".photo-upload-form");
    const form = target === "marker" ? forms.first() : forms.last();
    const fileInput = form.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("multiple", "");
    await fileInput.setInputFiles(["first.png", "second.png", "third.png"].map(name => ({ name, mimeType: "image/png", buffer: Buffer.from("photo") })));
    await form.getByLabel("Date taken", { exact: true }).fill("2026-10-15");
    await form.getByLabel("Notes", { exact: true }).fill("Field photos");
    await form.getByRole("button", { name: "Upload photos", exact: true }).click();
    await expect(form.getByRole("status")).toHaveText("2 of 3 photos uploaded and linked.");
    await expect(form.getByRole("alert")).toContainText("1 photo failed");
    await expect(form.getByRole("list", { name: "Photo upload results" })).toContainText("third.png: Uploaded");
    expect(uploaded).toEqual(["first.png", "second.png", "third.png"]);
    fail = false;
    await form.getByRole("button", { name: "Retry failed photos", exact: true }).click();
    await expect(form.getByRole("status")).toHaveText("Photo uploaded and linked.");
    expect(uploaded).toEqual(["first.png", "second.png", "third.png", "second.png"]);
    await expect(form.getByRole("alert")).toHaveCount(0);
    await fileInput.setInputFiles(["fourth.png", "fifth.png"].map(name => ({ name, mimeType: "image/png", buffer: Buffer.from("photo") })));
    await form.getByLabel("Date taken", { exact: true }).fill("2026-10-15");
    await form.getByLabel("Notes", { exact: true }).fill("Field photos");
    await form.getByRole("button", { name: "Upload photos", exact: true }).click();
    await expect(form.getByRole("status")).toHaveText("2 of 2 photos uploaded and linked.");
    expect(uploaded.slice(-2)).toEqual(["fourth.png", "fifth.png"]);
    await expect(form.getByRole("button", { name: "Upload photo", exact: true })).toBeDisabled();
  });
}
