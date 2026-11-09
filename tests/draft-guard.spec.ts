import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/draft-guard.html");
  await expect(page.getByLabel("First source", { exact: true })).toHaveValue("Initial source");
});

test("equal copies and edits reverted to the baseline do not prompt", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", async dialog => { dialogs++; await dialog.dismiss(); });
  await page.getByRole("button", { name: "Equal copy First" }).click();
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await expect(page.getByLabel("Navigation count")).toHaveText("1");
  await page.getByLabel("First source", { exact: true }).fill("Changed");
  await page.getByRole("button", { name: "Revert First" }).click();
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await expect(page.getByLabel("Navigation count")).toHaveText("2");
  expect(dialogs).toBe(0);
});

test("cancel keeps all dirty forms; confirmation discards each once", async ({ page }) => {
  await page.getByLabel("First source", { exact: true }).fill("First changed");
  await page.getByLabel("Second source", { exact: true }).fill("Second changed");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await expect(page.getByLabel("Navigation count")).toHaveText("0");
  await expect(page.getByLabel("First source", { exact: true })).toHaveValue("First changed");
  await expect(page.getByLabel("Second source", { exact: true })).toHaveValue("Second changed");
  await expect(page.getByLabel("First discards")).toHaveText("0");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await expect(page.getByLabel("First source", { exact: true })).toHaveValue("Initial source");
  await expect(page.getByLabel("Second source", { exact: true })).toHaveValue("Initial source");
  await expect(page.getByLabel("First discards")).toHaveText("1");
  await expect(page.getByLabel("Second discards")).toHaveText("1");
});

test("successful replacement accepts the new baseline; a later edit still prompts", async ({ page }) => {
  await page.getByLabel("First source", { exact: true }).fill("Saved value");
  await page.getByRole("button", { name: "Accept save First" }).click();
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await expect(page.getByLabel("Navigation count")).toHaveText("1");
  await page.getByRole("button", { name: "Revert First" }).click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await expect(page.getByLabel("Navigation count")).toHaveText("1");
  await page.getByRole("button", { name: "Load baseline First" }).click();
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await expect(page.getByLabel("Navigation count")).toHaveText("2");
});

test("beforeunload checks current changes immediately and unmount removes registrations", async ({ page }) => {
  const blocked = () => page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(await blocked()).toBe(false);
  await page.getByLabel("First source", { exact: true }).fill("Unsaved");
  expect(await blocked()).toBe(true);
  await page.getByRole("button", { name: "Unmount forms" }).click();
  expect(await blocked()).toBe(false);
});

test("two navigation checks in the same event confirm and discard once", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", async dialog => { dialogs++; await dialog.accept(); });
  await page.getByLabel("First source", { exact: true }).fill("Unsaved");
  await page.getByRole("button", { name: "Navigate twice", exact: true }).click();
  await expect(page.getByLabel("Navigation count")).toHaveText("1");
  await expect(page.getByLabel("First discards")).toHaveText("1");
  expect(dialogs).toBe(1);
});

test("typing and unrelated rerenders do not serialize drafts before a navigation check", async ({ page }) => {
  await page.evaluate(() => { window.guardProfile.serializations = []; });
  await page.getByLabel("First source", { exact: true }).pressSequentially("typing");
  await page.getByRole("button", { name: /^Rerender First/ }).click();
  expect(await page.evaluate(() => window.guardProfile.serializations.length)).toBe(0);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  expect(await page.evaluate(() => window.guardProfile.serializations.length)).toBeGreaterThan(0);
});
