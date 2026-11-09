import { expect, test, type Route } from "@playwright/test";

const rows = Array.from({ length: 55 }, (_, i) => ({ id: `remote-${i}`, code: `HS-${i}`, label: `Marker ${i}` }));

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/record-options.html");
  await expect(page.getByTestId("state")).toBeVisible();
});

test("remote options retain selections across bounded pages and debounce search with an offset reset", async ({ page }) => {
  const requests: URL[] = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    requests.push(url);
    const offset = Number(url.searchParams.get("offset"));
    return route.fulfill({ json: url.searchParams.get("q") ? [] : rows.slice(offset, offset + 51) });
  });
  await page.clock.install({ time: new Date("2026-11-09T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-09T12:00:01Z"));
  await expect(page.getByTestId("state")).toContainText('"loading":false');
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await expect(page.getByTestId("state")).toContainText('"count":50');
  expect(Object.fromEntries(requests[0].searchParams)).toEqual({ kind: "headstones", q: "", offset: "0", limit: "51", excludeId: "self/marker", cemeteryId: "cemetery/one" });
  await page.getByLabel("Remember option").selectOption("remote-0");
  await page.getByRole("button", { name: "Next options" }).click();
  await expect(page.getByTestId("state")).toContainText('"count":5');
  await expect(page.getByLabel("Remember option").locator("option")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Next options" })).toBeDisabled();
  await page.getByLabel("Search options").fill("query & text");
  await expect(page.getByTestId("state")).toContainText('"offset":0');
  // Resetting the offset retains the old debounced query until the timer fires.
  await expect(page.getByTestId("state")).toContainText('"count":50');
  const before = requests.length;
  await page.getByLabel("Search options").fill("final & text");
  await expect(page.locator("html")).toHaveAttribute("data-record-options-query", "final & text");
  await page.clock.runFor(199);
  expect(requests).toHaveLength(before);
  await page.clock.runFor(1);
  await expect(page.getByTestId("state")).toContainText('"count":0');
  expect(requests.at(-1)!.searchParams.get("q")).toBe("final & text");
  await expect(page.getByText("No matching records. Try another search.")).toBeVisible();
  await expect(page.getByLabel("Remember option").locator("option")).toHaveCount(1);
  await expect(page.getByLabel("Remember option").locator("option")).toHaveAttribute("value", "remote-0");
});

test("legacy options filter and paginate locally, even while remote loading is disabled", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/")) requests.push(request.url()); });
  await page.clock.install({ time: new Date("2026-11-09T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-09T12:00:01Z"));
  await page.getByRole("button", { name: "Legacy", exact: true }).click();
  await expect(page.getByTestId("state")).toContainText('"count":50');
  await page.getByRole("button", { name: "Next options" }).click();
  await expect(page.getByTestId("state")).toContainText('"count":5');
  await page.getByLabel("Search options").fill("LOCAL-54");
  await expect(page.locator("html")).toHaveAttribute("data-record-options-query", "LOCAL-54");
  await page.clock.runFor(200);
  await expect(page.getByTestId("state")).toContainText('"count":1');
  await expect(page.getByTestId("state")).toContainText('"offset":0');
  await expect(page.getByLabel("Remember option").locator("option")).toHaveCount(2);
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await expect(page.getByTestId("state")).toContainText('"loading":false');
  expect(requests).toEqual([]);
});

for (const kind of ["gravesites", "field-markers", "task-gravesites"]) {
  test(`${kind} uses the correct authenticated endpoint and scope`, async ({ page }) => {
    await page.evaluate(async () => {
      const { setAccessTokenProvider } = await import("/src/api/apiClient.ts");
      setAccessTokenProvider(async () => "fixture-options-token");
    });
    let requestUrl: URL | undefined;
    let authorization: string | undefined;
    await page.route("**/api/**", route => {
      requestUrl = new URL(route.request().url());
      authorization = route.request().headers().authorization;
      return route.fulfill({ json: [] });
    });
    await page.getByLabel("Kind", { exact: true }).selectOption(kind);
    await page.getByRole("button", { name: "Toggle enabled" }).click();
    await expect(page.getByTestId("state")).toContainText('"loading":false');
    await expect.poll(() => requestUrl?.pathname).toBe(kind === "gravesites" ? "/api/record-options" : `/api/${kind}`);
    expect(requestUrl!.searchParams.get("kind")).toBe(kind);
    expect(requestUrl!.searchParams.get("cemeteryId")).toBe("cemetery/one");
    expect(authorization).toBe("Bearer fixture-options-token");
  });
}

test("scope changes cancel pending loads; errors retain rows and clear on the next search", async ({ page }) => {
  const pending: Route[] = [];
  const aborted: string[] = [];
  page.on("requestfailed", request => aborted.push(request.url()));
  await page.route("**/api/**", route => { pending.push(route); });
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await expect.poll(() => pending.length).toBe(1);
  await expect(page.getByText("Loading options…")).toBeVisible();
  await page.getByRole("button", { name: "Other cemetery" }).click();
  await expect.poll(() => pending.length).toBe(2);
  await expect.poll(() => aborted.length).toBe(1);
  await pending[1].fulfill({ json: rows.slice(0, 2) });
  await pending[0].fulfill({ json: rows }).catch(() => {});
  await expect(page.getByTestId("state")).toContainText('"count":2');
  await page.getByLabel("Search options").fill("failure");
  await expect.poll(() => pending.length).toBe(3);
  await pending[2].fulfill({ status: 403, json: {} });
  await expect(page.getByRole("alert")).toContainText("permission");
  await expect(page.getByTestId("state")).toContainText('"count":2');
  await page.getByLabel("Search options").fill("retry");
  await expect.poll(() => pending.length).toBe(4);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await pending[3].fulfill({ json: [] });
  await expect(page.getByText("No matching records. Try another search.")).toBeVisible();
});
