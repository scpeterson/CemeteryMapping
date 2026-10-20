import { expect, test } from "@playwright/test";
import { select } from "./fixtures/cemetery";
import { marker, overviewFixture } from "./fixtures/overview";
import type { MarkerFace } from "../src/types";

test("inscription status clears text only after confirmation and locks whole-marker and face text", async ({ page }) => {
  await overviewFixture(page);
  let faces: MarkerFace[] = [{ id: "11111111-1111-4111-8111-111111111112", label: "Unspecified face", inscription: "NAME\n[blank] – [illegible]", inscriptionStatus: "transcribed", notes: "", burialIds: [], mediaAssetIds: [] }];
  let revision = 0;
  await page.route("**/api/headstone-lookups", (route) => route.fulfill({ json: {
    markerTypes: [marker.markerType], markerScopes: [marker.markerScope], materials: [marker.material], conditions: [marker.condition],
  } }));
  await page.route("**/api/headstones/marker-1", async (route) => {
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON();
      faces = payload.faces;
      for (const face of faces) if (["blank", "illegible"].includes(face.inscriptionStatus!)) expect(face.inscription).toBe("");
      revision++;
    }
    await route.fulfill({ json: { ...marker, faces, facesRevision: revision } });
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  const status = page.getByRole("combobox", { name: "Inscription status", exact: true });
  const text = page.getByRole("textbox", { name: "Inscription", exact: true });
  page.once("dialog", (dialog) => dialog.dismiss());
  await status.selectOption("blank");
  await expect(text).toHaveValue("NAME\n[blank] – [illegible]");
  await expect(status).toHaveValue("transcribed");
  page.once("dialog", (dialog) => dialog.accept());
  await status.selectOption("blank");
  await expect(text).toHaveValue("");
  await expect(text).toBeDisabled();
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("region", { name: "Unspecified face", exact: true })).toContainText("Inscription status: Blank");
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await page.getByRole("button", { name: "Manage faces", exact: true }).click();
  await page.getByRole("button", { name: "Add face", exact: true }).click();
  const second = page.getByRole("group", { name: "Face 2", exact: true });
  await second.getByLabel("Face label", { exact: true }).fill("Back");
  await second.getByRole("combobox", { name: "Inscription status", exact: true }).selectOption("illegible");
  await expect(second.getByRole("textbox", { name: "Inscription", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("region", { name: "Back", exact: true })).toContainText("Inscription status: Illegible");
  await page.getByRole("button", { name: "Edit marker HS-OVERVIEW" }).click();
  await second.getByRole("combobox", { name: "Inscription status", exact: true }).selectOption("transcribed");
  const partial = "  NAME\n[blank] – 1980\n[illegible lines]  ";
  await second.getByRole("textbox", { name: "Inscription", exact: true }).fill(partial);
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  expect(faces[1].inscription).toBe(partial);
  expect(faces[1].inscriptionStatus).toBe("transcribed");
});
