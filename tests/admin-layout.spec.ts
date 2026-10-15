import { expect, test } from "@playwright/test";
import { cemeteryId, fixture } from "./fixtures/cemetery";

const longText = "A long cemetery record description with additional context for administrators ".repeat(4);
const cemetery = { id: cemeteryId, name: "Trinity Lutheran Church Cemetery", fullAddress: longText, municipality: "Pittsburgh", agency: "Church", agencyUrl: "", operationalHours: "", contactName: "", contactPhone: "", contactEmail: "", imageUrl: "", notes: longText, createdAt: "", updatedAt: "" };
const event = { id: "event-1", occurredAt: "2026-10-15T12:00:00Z", source: "test", actorEmail: "long-administrator-email@example.test", action: "UPDATE", targetTable: "gravesites", targetRecordId: cemeteryId, changedFields: ["notes"], previousValues: { notes: "" }, newValues: { notes: longText }, reason: longText, eventType: "job_run", severity: "info", status: "success", message: longText, detail: longText, metadata: {}, requestPath: "", environment: "test" };
const reading = { id: "reading-1", batchId: "batch-1", nameText: "STEELE/STEEL/MEHRLICH", surnames: ["STEELE", "STEEL", "MEHRLICH"], rawText: longText, inscriptionText: longText, parsedSectionName: "D", parsedRowNumber: 3, parsedPositionNumber: 1, parsedMarkerScope: "couple", parsedYears: [1841, 1920], parseConfidence: "high", parseNotes: [], status: "staged", sourcePageNumber: 222, sourceLineStart: 1, sourceLineEnd: 2, candidateMatches: [], sourceFacts: [], observations: [], processingSummary: { isProcessed: false, pendingCount: 1, totalCount: 1, label: "1 pending", detail: longText } };

for (const tab of ["Users", "Records", "Quality", "Deeds", "Readings", "Audit", "System"]) {
  test(`Admin ${tab} fits within the dialog and scrolls to its final controls`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => { pageErrors.push(error.message); });
    await fixture(page);
    await page.route("**/api/admin/**", route => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = [];
      if (path.endsWith("/access-request-stats")) json = { pending: 0, lastHour: 0, limits: { pending: 100, hourly: 100 } };
      else if (path.endsWith("/cemetery-records")) json = { cemeteries: [cemetery], sections: [{ id: "section-1", cemeteryId, sectionId: "D", name: "D", alternateNames: ["Original Cemetery"], notes: longText }], lots: [{ id: "lot-1", cemeteryId, sectionId: "D", lotId: "1", name: longText }] };
      else if (path.endsWith("/users")) json = [{ id: "user-1", email: "long-administrator-email@example.test", displayName: "Cemetery Administrator", externalSubject: "auth0|example", role: "admin", assignedCemeteryIds: [], isActive: true }];
      else if (path.endsWith("/roles")) json = ["reader", "power-user", "cemetery-admin", "admin"].map(name => ({ name, description: longText, userCount: 1 }));
      else if (path.includes("retention-policy")) json = { retentionDays: 400, minimumProtectedDays: 365, batchSize: 5000, isEnabled: true };
      else if (path.includes("audit-events") || path.includes("system-events")) json = [event];
      else if (path.includes("deed-registry-review")) json = { batches: [{ id: "deed-batch", sourceName: "Deed registry", worksheetName: "Updated 2022", createdAt: "2026-10-15T12:00:00Z", entryCount: 1 }], selectedBatchId: "deed-batch", summary: [], comparison: null, removedOriginalEntries: [], entries: [{ id: "deed-entry", batchId: "deed-batch", sourceRowNumber: 1, rowType: "owner_record", ownerDisplayName: "A long family name and associated cemetery ownership record", deedOnFile: "Yes", deedRegisterOnFile: "Yes", parsedSectionName: "D", parsedSectionAlias: "", originalRawLotText: "12", originalRawSectionText: "D", originalRawRemarks: "", rawLotText: "12", rawSectionText: "Original Cemetery", lastKnownDate: "1944", modernSection: "D", correctedLotText: "12", correctedLastKnownDate: "1944", rawRemarks: longText, correctedRemarks: longText, parsedLotNumbers: ["12"], parsedPlotNumbers: [], parsedGraveNumbers: [], ownershipScope: "lot", parseConfidence: "high", parseNotes: [], status: "staged", allocationCount: 1, relatedInvestigationNotes: [], comparisonStatus: "matched" }] };
      else if (path.includes("north-hills-ocr")) json = { batches: [{ id: "batch-1", sourceName: "North Hills Genealogists", cemeteryName: cemetery.name, entryCount: 1 }], selectedBatchId: "batch-1", summary: [], entries: [reading] };
      else if (path.includes("data-quality-dashboard")) json = { scope: "all", cemeteries: [cemetery], generatedAt: "2026-10-15T12:00:00Z", totalOpenItems: 1, metrics: [{ id: "nhg_unlinked", label: longText, description: longText, count: 1, severity: "medium", category: "Readings" }] };
      return route.fulfill({ json });
    });
    await page.goto("/");
    await page.getByRole("button", { name: /^Open administration:/ }).click();
    const admin = page.getByRole("dialog", { name: "Admin management" });
    await admin.getByRole("button", { name: tab, exact: true }).click();
    await expect(admin.locator(".admin-content")).not.toBeEmpty();
    await expect(admin.locator('[role="alert"]')).toHaveCount(0);
    if (tab === "Readings") {
      await expect(admin.locator(".deed-entry-row")).toHaveCount(1);
      const filters = admin.locator(".reading-review-filter-form");
      const limit = await filters.getByRole("combobox", { name: "Limit", exact: true }).boundingBox();
      const apply = await filters.getByRole("button", { name: "Apply filters", exact: true }).boundingBox();
      expect(apply!.x).toBeGreaterThan(limit!.x + limit!.width);
      expect(Math.abs(apply!.y - limit!.y)).toBeLessThan(2);
      const header = admin.locator(".reading-entry-header");
      await expect(header.locator(".reading-entry-name strong")).toHaveText("STEELE/STEEL/MEHRLICH");
      await expect(header.locator("wbr")).toHaveCount(2);
      const edit = await header.getByRole("button", { name: "Edit", exact: true }).boundingBox();
      const status = await header.locator(".reading-processing-status").boundingBox();
      expect(edit!.x).toBeLessThan(status!.x);
      await header.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(admin.locator(".reading-entry-edit-form")).toBeVisible();
    }
    const failures: string[] = [];
    for (const width of [1600, 1280, 1100, 900, 600]) {
      await page.setViewportSize({ width, height: 700 });
      await page.waitForTimeout(100);
      const overflow = await admin.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, offenders: [...el.querySelectorAll<HTMLElement>(".admin-content *")].filter(node => node.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).slice(0, 5).map(node => `${node.tagName}.${node.className}`) }));
      const clippedControls = await admin.evaluate(el => {
        const right = el.getBoundingClientRect().right;
        return [...el.querySelectorAll<HTMLElement>(".admin-content input, .admin-content select, .admin-content textarea, .admin-content button")]
          .filter(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().right > right + 1)
          .map(node => node.outerHTML.slice(0, 140));
      });
      if (clippedControls.length) failures.push(`${width}px clipped controls: ${JSON.stringify(clippedControls)}`);
      if (overflow.scroll > overflow.width) failures.push(`${width}px: ${JSON.stringify(overflow)}`);
      await admin.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const clearance = await admin.evaluate(el => el.getBoundingClientRect().bottom - el.querySelector(".admin-workspace")!.getBoundingClientRect().bottom);
      if (clearance < 10) failures.push(`${width}px: bottom clearance ${clearance}`);
    }
    expect(pageErrors).toEqual([]);
    expect(failures).toEqual([]);
  });
}
