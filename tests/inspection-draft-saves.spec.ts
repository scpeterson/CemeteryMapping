import { expect, test, type Page } from "@playwright/test";

const key = "cemetery-mapping:inspection-draft:v1:one:marker-one";
const stored = (page: Page, storageKey = key) => page.evaluate(key => localStorage.getItem(key), storageKey);
const edit = async (page: Page, text: string) => {
  await page.getByLabel("Source", { exact: true }).fill(text);
  // The harness effect runs after the hook has scheduled the committed snapshot.
  await expect(page.locator("html")).toHaveAttribute("data-inspection-draft", text);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Object.assign(window, { inspectionWrites: [] as string[] });
    Storage.prototype.setItem = function (key, value) {
      if (key.includes("inspection-draft")) (window as unknown as { inspectionWrites: string[] }).inspectionWrites.push(value);
      return original.call(this, key, value);
    };
  });
  await page.goto("/tests/inspection-draft.html");
  await expect(page.getByTestId("draft")).toBeVisible();
  await page.clock.install({ time: new Date("2026-11-09T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-09T12:00:01Z"));
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-inspection-draft", "Initial source");
});

test("rapid edits write only the latest complete snapshot after the debounce", async ({ page }) => {
  await edit(page, "First reading");
  await page.clock.runFor(300);
  await edit(page, "Latest reading");
  await page.getByRole("button", { name: "Face step" }).click();
  await expect(page.getByTestId("draft")).toContainText('"face":"front"');
  await page.clock.runFor(349);
  expect(await stored(page)).toBeNull();
  await page.clock.runFor(1);
  await expect.poll(() => stored(page)).toContain("Latest reading");
  const snapshot = JSON.parse((await stored(page))!);
  expect(snapshot).toMatchObject({ version: 1, updating: true, step: 1, activeFaceId: "front", draft: { source: "Latest reading" } });
  expect(await page.evaluate(() => (window as unknown as { inspectionWrites: string[] }).inspectionWrites.length)).toBe(1);
});

for (const event of ["beforeunload", "pagehide", "hidden", "unmount"]) {
  test(`${event} flushes pending edits without waiting for the timer`, async ({ page }) => {
    await edit(page, `Pending ${event}`);
    if (event === "unmount") await page.getByRole("button", { name: "Toggle editor" }).click();
    else await page.evaluate(event => {
      if (event === "hidden") {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      } else window.dispatchEvent(new Event(event));
    }, event);
    await expect.poll(() => stored(page)).toContain(`Pending ${event}`);
    await page.clock.runFor(1000);
    expect(await page.evaluate(() => (window as unknown as { inspectionWrites: string[] }).inspectionWrites.length)).toBe(1);
  });
}

for (const alreadyStored of [false, true]) {
  test(`finish/discard cancels pending writes without recreating recovery (${alreadyStored ? "existing snapshot" : "pending only"})`, async ({ page }) => {
    if (alreadyStored) {
      await page.clock.runFor(350);
      await expect.poll(() => stored(page)).toContain("Initial source");
    }
    await edit(page, "Discard pending");
    await page.getByRole("button", { name: "Finish or discard" }).click();
    await page.clock.runFor(1000);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    expect(await stored(page)).toBeNull();
    expect(await page.evaluate(() => (window as unknown as { inspectionWrites: string[] }).inspectionWrites.length)).toBe(alreadyStored ? 1 : 0);
    await page.getByRole("button", { name: "Toggle editor" }).click();
    expect(await stored(page)).toBeNull();
  });
}

test("account and marker changes flush to the old key and never leak drafts into the new editor", async ({ page }) => {
  await edit(page, "Account one marker one");
  await page.getByRole("button", { name: "Switch marker" }).click();
  await expect.poll(() => stored(page)).toContain("Account one marker one");
  await expect(page.getByTestId("draft")).toContainText('"recovery":null');
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await edit(page, "Account one marker two");
  await page.getByRole("button", { name: "Switch account" }).click();
  await expect.poll(() => stored(page, key.replace("marker-one", "marker-two"))).toContain("Account one marker two");
  await expect(page.getByTestId("draft")).toContainText('"recovery":null');
  expect(await stored(page, key.replace(":one:", ":two:"))).toBeNull();
});

test("reload flushes saved-record/photo retry state and retains file names without serializing files", async ({ page }) => {
  await page.getByRole("button", { name: "Photo", exact: true }).click();
  await page.getByRole("button", { name: "Record saved", exact: true }).click();
  await expect(page.getByTestId("draft")).toContainText('"recordSaved":true');
  await page.reload();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByTestId("draft")).toContainText('"missingFileName":"draft.png"');
  await expect(page.getByTestId("draft")).toContainText('"recordSaved":true');
  const snapshot = JSON.parse((await stored(page))!);
  expect(snapshot.draft.photos[0]).toMatchObject({ notes: "Photo notes", missingFileName: "draft.png" });
  expect(snapshot.draft.photos[0]).not.toHaveProperty("file");
});

test("failed flush reports unavailable storage and a later flush retries the retained snapshot", async ({ page }) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes("inspection-draft") && !(window as unknown as { allowDraftStorage?: boolean }).allowDraftStorage) throw new Error("Storage unavailable");
      original.call(this, key, value);
    };
  });
  await edit(page, "Retained after failure");
  await page.clock.runFor(350);
  await expect(page.getByTestId("draft")).toContainText('"unavailable":true');
  await page.evaluate(() => {
    Object.assign(window, { allowDraftStorage: true });
    window.dispatchEvent(new Event("pagehide"));
  });
  await expect.poll(() => stored(page)).toContain("Retained after failure");
  await expect(page.getByTestId("draft")).toContainText('"unavailable":false');
});
