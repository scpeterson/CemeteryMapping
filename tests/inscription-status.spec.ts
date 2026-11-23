import { expect, test } from "@playwright/test";
import { select } from "./fixtures/cemetery";
import { marker, overviewFixture } from "./fixtures/overview";
import type { MarkerFace } from "../src/types";

test("whole-face flags require empty text and retain archived readings", async ({ page }) => {
  await overviewFixture(page);
  let faces: MarkerFace[] = [{ id: "11111111-1111-4111-8111-111111111112", label: "Unspecified face", inscription: "NAME\n[blank] – [illegible]", inscriptionStatus: "transcribed", notes: "", burialIds: [], mediaAssetIds: [] }];
  let revision = 0;
  await page.route("**/api/headstone-lookups*", (route) => route.fulfill({ json: {
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
  await page.getByRole("button", { name: "Edit face records" }).click();
  const status = page.getByRole("combobox", { name: "Inscription status", exact: true });
  await expect(page.getByRole("checkbox", { name: "Blank", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Illegible", exact: true })).toBeDisabled();
  const text = page.getByRole("textbox", { name: "Inscription", exact: true });
  page.once("dialog", (dialog) => dialog.dismiss());
  await status.selectOption("not_recorded");
  await expect(text).toHaveValue("NAME\n[blank] – [illegible]");
  await expect(status).toHaveValue("transcribed");
  page.once("dialog", (dialog) => dialog.accept());
  await status.selectOption("not_recorded");
  await expect(text).toHaveValue("");
  await page.getByRole("checkbox", { name: "Blank", exact: true }).check();
  await expect(text).toBeDisabled();
  await expect(page.getByRole("region", { name: "Historical transcriptions", exact: true })).toContainText("NAME");
  await page.getByRole("textbox", { name: "Historical transcription", exact: true }).fill("Earlier source reading");
  await page.getByRole("textbox", { name: "Historical source", exact: true }).fill("NHG");
  await expect(page.getByRole("textbox", { name: "Source year or date", exact: true })).toHaveValue("2005-10-11");
  await page.getByRole("button", { name: "Add historical transcription", exact: true }).click();
  await expect(text).toBeDisabled();
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("region", { name: "Unspecified face", exact: true })).toContainText("Inscription status: Blank");
  await page.getByRole("button", { name: "Edit face records" }).click();
  await page.getByRole("button", { name: "Manage faces", exact: true }).click();
  await page.getByRole("button", { name: "Add face", exact: true }).click();
  const second = page.getByRole("group", { name: "Face 2", exact: true });
  await second.getByLabel("Face label", { exact: true }).fill("Back");
  await second.getByRole("checkbox", { name: "Illegible", exact: true }).check();
  await expect(second.getByRole("textbox", { name: "Inscription", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("region", { name: "Back", exact: true })).toContainText("Inscription status: Illegible");
  await page.getByRole("button", { name: "Edit face records" }).click();
  await second.getByRole("checkbox", { name: "Illegible", exact: true }).uncheck();
  await second.getByRole("combobox", { name: "Current legibility", exact: true }).selectOption("partially_legible");
  const partial = "  NAME\n[blank] – 1980\n[illegible lines]  ";
  await second.getByRole("textbox", { name: "Inscription", exact: true }).fill(partial);
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("region", { name: "Back", exact: true })).toContainText("1980");
  expect(faces[1].inscription).toBe(partial);
  expect(faces[1].inscriptionStatus).toBe("transcribed");
  expect(faces[0].historicalTranscriptions?.some((entry) => entry.source === "NHG" && entry.sourceDate === "2005-10-11")).toBe(true);
  expect(faces[0].historicalTranscriptions?.[0].text).toBe("NAME\n[blank] – [illegible]");
});


for (const width of [1280, 390]) test(`face checkboxes are exclusive and protect mixed text at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await overviewFixture(page);
  let savedFaces: MarkerFace[] = [{ id: "11111111-1111-4111-8111-111111111112", label: "Front", inscription: "  [ILLEGIBLE]\n", inscriptionStatus: "transcribed", notes: "", burialIds: [], mediaAssetIds: [] }];
  await page.route("**/api/headstone-lookups*", route => route.fulfill({ json: { markerTypes: [marker.markerType], markerScopes: [marker.markerScope], materials: [marker.material], conditions: [marker.condition] } }));
  await page.route("**/api/headstones/marker-1", async route => {
    if (route.request().method() === "PATCH") savedFaces = route.request().postDataJSON().faces;
    await route.fulfill({ json: { ...marker, faces: savedFaces, facesRevision: 0 } });
  });
  await page.goto("/");
  if (width < 800) await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Search", exact: true }).click();
  await select(page, "A-TEST");
  await page.getByRole("tabpanel", { name: "Overview", exact: true }).getByRole("button", { name: /HS-OVERVIEW/ }).click();
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await page.getByRole("button", { name: "Edit face records" }).click();
  const blank = page.getByRole("checkbox", { name: "Blank", exact: true });
  const illegible = page.getByRole("checkbox", { name: "Illegible", exact: true });
  const text = page.getByRole("textbox", { name: "Inscription", exact: true });
  await expect(illegible).toBeChecked(); await expect(blank).not.toBeChecked();
  await expect(text).toHaveValue(""); await expect(text).toBeDisabled();
  await illegible.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`face-flags-${width}.png`) });
  await blank.check(); await expect(illegible).not.toBeChecked();
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  // Wait for the PATCH to finish and close the editor before inspecting fixture state.
  await expect(page.getByRole("button", { name: "Edit face records", exact: true })).toBeVisible();
  expect(savedFaces[0].inscription).toBe(""); expect(savedFaces[0].inscriptionStatus).toBe("blank"); expect(savedFaces[0].currentLegibility).toBe("blank");
  await page.getByRole("button", { name: "Edit face records" }).click();
  await expect(blank).toBeChecked(); await blank.uncheck(); await expect(text).toBeEnabled();
  for (const value of ["Blank family", "illegible", "NAME [illegible]\n[blank] 1880", "[illegible lines]"]) {
    await text.fill(value); await expect(blank).toBeDisabled(); await expect(illegible).toBeDisabled(); await expect(text).toHaveValue(value);
  }
  await text.fill("[blank]"); await expect(blank).toBeEnabled(); await expect(illegible).toBeEnabled();
  await expect(blank).not.toBeChecked();
  // Entering a placeholder prefix must not interrupt typing a legitimate mixed reading.
  await text.press("End"); await text.pressSequentially(" surname");
  await expect(blank).toBeDisabled(); await expect(text).toHaveValue("[blank] surname");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit face records", exact: true })).toBeVisible();
  expect(savedFaces[0].inscription).toBe("[blank] surname"); expect(savedFaces[0].inscriptionStatus).toBe("transcribed");
  await page.getByRole("button", { name: "Edit face records" }).click();
  await text.fill(" \n "); await expect(blank).toBeEnabled(); await blank.check(); await expect(text).toHaveValue("");
  await expect(illegible).not.toBeChecked();
});
