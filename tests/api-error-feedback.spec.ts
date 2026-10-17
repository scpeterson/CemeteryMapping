import { expect, test } from "@playwright/test";
import { select } from "./fixtures/cemetery";
import { overviewFixture } from "./fixtures/overview";

for (const [status, expected] of [
  [401, "Sign in again"], [403, "don't have permission"], [404, "no longer available"],
  [409, "Reload the latest version"], [413, "Choose a smaller file"],
  [500, "Reference: test-reference"], [0, "Couldn't reach the server"],
] as const) {
  test(`failed save (${status}) explains recovery and preserves edits`, async ({ page }) => {
    await overviewFixture(page);
    await page.route("**/api/burials/alice", (route) => status === 0 ? route.abort("failed") : route.fulfill({
      status, json: status === 500 ? { error: "private SQL detail", referenceId: "test-reference" } : {},
    }));
    await page.goto("/");
    await select(page, "A-TEST");
    await page.getByRole("tab", { name: "People and ownership" }).click();
    await page.getByRole("button", { name: "Edit burial Alice Example" }).click();
    const name = page.getByRole("textbox", { name: "First name", exact: true });
    await name.fill("Alicia");
    await page.getByRole("button", { name: "Save burial", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(expected);
    await expect(page.getByRole("alert")).not.toContainText("private SQL");
    await expect(name).toHaveValue("Alicia");
  });
}
