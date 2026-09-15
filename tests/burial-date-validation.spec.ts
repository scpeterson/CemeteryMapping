import { expect, test } from "@playwright/test";
import { select } from "./fixtures/cemetery";
import { overviewFixture, overviewGrave } from "./fixtures/overview";

for (const [field, label] of [["birthDate", "Birth date"], ["deathDate", "Death date"]] as const) {
  test(`${label} validation shows a helpful error and preserves edits for retry`, async ({ page }) => {
    await overviewFixture(page);
    const message = `${label} "2002-11-31" is not a valid calendar date. Check the year, month, and day.`;
    await page.route("**/api/burials/alice", async (route) => {
      const input = route.request().postDataJSON();
      if (input[field] === "2002-11-31") return route.fulfill({ status: 400, json: { error: message } });
      expect(input[field]).toBe("2002-11-30");
      expect(input.firstName).toBe("Alicia");
      const burial = overviewGrave("A-TEST").burials[0];
      return route.fulfill({ json: { ...burial, person: { ...burial.person, firstName: input.firstName, [field]: input[field] } } });
    });
    await page.goto("/");
    await select(page, "A-TEST");
    await page.getByRole("tab", { name: "People and ownership" }).click();
    await page.getByRole("button", { name: "Edit burial Alice Example" }).click();
    const date = page.getByRole("textbox", { name: label, exact: true });
    await page.getByRole("textbox", { name: "First name", exact: true }).fill("Alicia");
    await date.fill("2002-11-31");
    await page.getByRole("button", { name: "Save burial", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(message);
    await expect(date).toHaveValue("2002-11-31");
    await expect(page.getByRole("textbox", { name: "First name", exact: true })).toHaveValue("Alicia");
    await date.fill("2002-11-30");
    await page.getByRole("button", { name: "Save burial", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save burial", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit burial Alicia Example" })).toBeVisible();
  });
}
