import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

const report = (id: string) => ({ id, title: id, category: "Records", requiredRole: "reader", parameters: [], examples: [], description: id });
const result = (id: string) => ({ report: report(id), summary: `${id} result`, generatedAt: "2026-09-21T12:00:00Z", columns: [], rows: [], notes: [] });

test("an obsolete report response cannot replace a newer selection and result", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/reports", (route) => route.fulfill({ json: [report("First"), report("Second")] }));
  await page.route("**/api/reports/run", (route) => route.fulfill({ json: result("Second") }));
  await page.addInitScript((oldResult) => {
    const original = window.fetch.bind(window);
    let first = true;
    window.fetch = (input, options) => {
      if (first && String(input).endsWith("/reports/run")) {
        first = false;
        document.documentElement.dataset.oldReportPending = "true";
        // Deliberately ignore cancellation to exercise the stale-completion guard too.
        return new Promise<Response>((resolve) => {
          Object.assign(window, { finishOldReport: () => resolve(new Response(JSON.stringify(oldResult), { status: 200, headers: { "Content-Type": "application/json" } })) });
        });
      }
      return original(input, options);
    };
  }, result("First"));
  await page.goto("/");
  await page.getByRole("button", { name: "Open reports: run saved cemetery reports and guided queries", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-old-report-pending", "true");
  await page.getByRole("button", { name: "Second reader" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Reports", exact: true })).toContainText("Second result");
  await page.evaluate(() => (window as unknown as { finishOldReport(): void }).finishOldReport());
  await expect(page.getByRole("dialog", { name: "Reports", exact: true })).not.toContainText("First result");
});

test("query parameters survive selection of the matched report", async ({ page }) => {
  await fixture(page);
  const matched = { ...report("Matched"), parameters: [{ name: "year", label: "Year", required: true, type: "text" }] };
  await page.route("**/api/reports", (route) => route.fulfill({ json: [report("First"), matched] }));
  await page.route("**/api/reports/query", (route) => route.fulfill({ json: { matched: true, report: matched, parameters: { year: "1929" }, message: "Ready" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Open reports: run saved cemetery reports and guided queries", exact: true }).click();
  await page.getByPlaceholder("Ask a cemetery question").fill("Burials in 1929");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByLabel("Year", { exact: true })).toHaveValue("1929");
});
