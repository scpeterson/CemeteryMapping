import { expect, test } from "@playwright/test";
import { detail, gravePath, select } from "./fixtures/cemetery";
import { marker, overviewFixture } from "./fixtures/overview";

const note = "A two foot high statue of a seated child with a basket in its lap is located in line with other tombstones in this row, at this place. The stone is weathered and there is no inscription. Stone 9C, 4, which is now missing, was located at what would be the foot of this grave. No stone with this inscription was found on second reading, only a flat spot in the earth. See previous paragraph. See also the note with (8C, 1), William L Eadie.";
const evidence = [{
  id: "eadie-link", entryId: "eadie", targetType: "headstone", status: "linked", confidence: "high",
  sourcePageNumber: 208, nameText: "EADIE", parsedSectionName: "C", parsedRowNumber: 9, parsedPositionNumber: 4,
  rawText: 'EADIE (9C, 4, s) "Hilda G. Eadie / 1929-1988"', readingNotes: [note], reviewNotes: "Confirmed association",
  reviewedByEmail: "", reviewedAt: "",
}, {
  id: "william-link", entryId: "william", targetType: "headstone", status: "linked", confidence: "high",
  nameText: "EADIE", parsedSectionName: "C", rawText: "William L Eadie", reviewNotes: "", reviewedByEmail: "", reviewedAt: "",
}];

for (const record of ["monument", "gravesite"]) {
  test(`linked NHG reading notes are visible for a ${record}`, async ({ page }) => {
    await overviewFixture(page);
    await page.route("**/api/headstones/marker-1", (route) => route.fulfill({ json: { ...marker, northHillsEvidence: evidence } }));
    await page.route(gravePath("A-TEST"), (route) => route.fulfill({ json: { ...detail("A-TEST"), northHillsEvidence: evidence } }));
    await page.goto("/");
    if (record === "monument") {
      await page.getByLabel("Search cemetery records").fill(marker.headstoneId);
      await page.locator(".result-card").filter({ hasText: `Monument ID: ${marker.headstoneId}` }).click();
      await page.getByRole("tab", { name: "Details", exact: true }).click();
    } else {
      await select(page, "A-TEST");
      await page.getByRole("tab", { name: "Sources / Evidence", exact: true }).click();
    }
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await expect(page.getByText("Review notes: Confirmed association", { exact: true })).toBeVisible();
    await expect(page.getByText("Reading notes", { exact: true })).toHaveCount(1);
    await expect(page.getByText("William L Eadie", { exact: true })).toBeVisible();
  });
}
