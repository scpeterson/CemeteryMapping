import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

for (const tab of ["Audit", "System"] as const) {
  test(`${tab} tab loads independently, filters events, and saves retention`, async ({ page }) => {
    await fixture(page);
    const audit = tab === "Audit";
    const eventsPath = `/api/admin/${audit ? "audit-events" : "system-events"}`;
    const policyPath = `/api/admin/${audit ? "audit" : "system-event"}-retention-policy`;
    const policy = { retentionDays: 400, minimumProtectedDays: audit ? 365 : 30, batchSize: 5000, isEnabled: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
    const event = {
      id: "event-1", occurredAt: "2026-01-01T12:00:00Z", source: "test", actorEmail: "reviewer@example.test",
      action: "UPDATE", targetTable: "gravesites", targetRecordId: "grave-1", changedFields: ["status"],
      previousValues: { status: "available" }, newValues: { status: "reserved" }, reason: "Review complete",
      eventType: "job_run", severity: "info", status: "success", message: "Review complete", detail: "Job detail",
      metadata: { result: "reserved" }, requestPath: "", environment: "test",
    };
    await page.route(`**${eventsPath}*`, (route) => route.fulfill({ json: [event] }));
    await page.route(`**${policyPath}`, (route) => route.fulfill({ json: { ...policy, ...(route.request().method() === "PUT" ? route.request().postDataJSON() : {}) } }));
    await page.goto("/");
    await page.getByRole("button", { name: /^Open administration:/ }).click();
    const admin = page.getByRole("dialog", { name: "Admin management" });
    await admin.getByRole("button", { name: tab, exact: true }).click();
    await expect(admin.locator(audit ? ".audit-event-detail" : ".system-event-detail")).toContainText('"reserved"');
    const filterForm = admin.locator(audit ? ".audit-filter-form" : ".system-event-filter-form");
    await filterForm.getByLabel(audit ? "Actor" : "Source", { exact: true }).fill("reviewer");
    const filtered = page.waitForRequest((request) => new URL(request.url()).pathname === eventsPath && new URL(request.url()).searchParams.get(audit ? "actor" : "source") === "reviewer");
    await filterForm.getByRole("button", { name: "Apply filters", exact: true }).click();
    await filtered;
    await admin.getByLabel("Retention days", { exact: true }).fill("450");
    const saved = page.waitForRequest((request) => new URL(request.url()).pathname === policyPath && request.method() === "PUT");
    await admin.getByRole("button", { name: "Save policy", exact: true }).click();
    expect((await saved).postDataJSON().retentionDays).toBe(450);
    await expect(admin).toContainText("retention policy saved.");
  });
}
