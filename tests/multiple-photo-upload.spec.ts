import { expect, test } from "@playwright/test";
import { overviewFixture } from "./fixtures/overview";
import { select } from "./fixtures/cemetery";

for (const target of ["gravesite panel", "monument panel"] as const) {
  test(`multiple monument photos from ${target} continue after failure and retry only failed files`, async ({ page }) => {
    await overviewFixture(page);
    await page.route("**/api/me", route => route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: { canManageUsers: true, canOpenAdminPanel: true, canUpdateHeadstones: true, canUpdateGravesites: true } } }));
    const uploaded: string[] = [];
    let fail = true;
    await page.route("**/api/headstones/marker-1/media-assets?**", route => {
      const params = new URL(route.request().url()).searchParams;
      const name = params.get("filename")!;
      uploaded.push(name);
      expect(params.get("notes")).toBe("Field photos");
      expect(params.get("capturedAt")).toBe("2026-10-15");
      expect(new URL(route.request().url()).pathname).toBe("/api/headstones/marker-1/media-assets");
      if (name === "second.png" && fail) return route.fulfill({ status: 500, json: { error: "Temporary upload failure" } });
      return route.fulfill({ json: { id: name, assetType: "photo", fileUrl: `/media/${name}` } });
    });
    await page.goto("/");
    await select(page, "A-TEST");
    if (target === "monument panel") {
      await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
      await page.getByRole("tab", { name: "Details", exact: true }).click();
    } else {
      await page.getByRole("tab", { name: "Monuments and photos" }).click();
    }
    await expect(page.getByRole("heading", { name: "Gravesite Photos", exact: true })).toHaveCount(0);
    await page.locator(".all-monument-photos > button").click();
    await page.getByRole("button",{name:"Add photos",exact:true}).click();
    const forms = page.locator(".monument-photo-workspace .photo-upload-form");
    await expect(forms).toHaveCount(1);
    const form = forms.first();
    await expect(form).toContainText("Linked monument");
    await expect(form).not.toContainText("Gravesite overview");
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
