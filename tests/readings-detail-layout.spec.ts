import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

const longText = "A detailed transcription with source notes and uncertain inscription evidence. ".repeat(5);
const match = { burialId: "burial-1", gravesiteUuid: "grave-1", gravesiteId: "TLC-GPS-0485-01", graveId: "0485A", sectionId: "D", fullName: "Margaret Mehrlich", score: 7, notes: longText, gravesiteEvidence: [], headstoneCandidates: [{ id: "marker-1", headstoneId: "TLC-HS-0485A", evidence: [] }] };
const fact = { id: "fact-1", entryId: "entry-1", sourceCode: "CRG", sourceLabel: "Church Records in German", factType: "death_date", factValue: "23 August 1910", factDate: "1910-08-23", rawText: longText, reviewNotes: longText, confidence: "review", status: "staged" };
const entry = { id: "entry-1", batchId: "batch-1", nameText: "STEELE/STEEL/MEHRLICH", surnames: ["STEELE", "STEEL", "MEHRLICH"], rawText: longText, inscriptionText: longText, parsedSectionName: "D", parsedRowNumber: 6, parsedPositionNumber: 1, parsedMarkerScope: "couple", parsedYears: [1834, 1910], parseConfidence: "high", parseNotes: [longText], status: "staged", sourcePageNumber: 226, sourceLineStart: 9, sourceLineEnd: 14, candidateMatchCount: 1, candidateMatches: [match], additionalCandidateMatches: [{ ...match, burialId: "burial-2", fullName: "Additional candidate" }], sourceFacts: [fact], observations: [{ id: "observation-1", observationType: "entry_note", observationText: longText, status: "staged" }], processingSummary: { isProcessed: false, pendingCount: 3, totalCount: 15, label: "3 pending", detail: longText } };

test("Readings populated facts, observations, candidates and editing stay within Admin", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/me", route => route.fulfill({ json: { role: "admin", assignedCemeteryIds: [], permissions: { canManageUsers: false, canOpenAdminPanel: true } } }));
  await page.route("**/api/admin/cemetery-records", route => route.fulfill({ json: { cemeteries: [], sections: [], lots: [] } }));
  await page.route("**/api/admin/north-hills-ocr-review**", route => route.fulfill({ json: { batches: [{ id: "batch-1", sourceName: "North Hills Genealogists", createdAt: "2026-10-15T12:00:00Z" }], selectedBatchId: "batch-1", summary: [], entries: [entry] } }));
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Readings", exact: true }).click();
  await expect(admin.locator(".reading-match-review").first()).toBeVisible();
  await admin.getByText("Show more possible matches", { exact: false }).click();
  const failures: string[] = [];
  for (const editing of [false, true]) {
    if (editing) await admin.locator(".reading-entry-header").getByRole("button", { name: "Edit", exact: true }).click();
    for (const width of [1600, 1280, 1100, 900, 600]) {
      await page.setViewportSize({ width, height: 700 });
      await page.waitForTimeout(100);
      const overflow = await admin.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, offenders: [...el.querySelectorAll<HTMLElement>("input,select,textarea,button")].filter(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().right > el.getBoundingClientRect().right).slice(0, 4).map(node => node.outerHTML.slice(0, 100)) }));
      if (overflow.scroll > overflow.width) failures.push(`${editing ? "edit" : "review"} ${width}px ${JSON.stringify(overflow)}`);
      await admin.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const clearance = await admin.evaluate(el => el.getBoundingClientRect().bottom - el.querySelector(".admin-workspace")!.getBoundingClientRect().bottom);
      if (clearance < 10) failures.push(`${width}px bottom clearance ${clearance}`);
    }
  }
  expect(failures).toEqual([]);
});
