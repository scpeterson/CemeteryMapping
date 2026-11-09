import { expect, test, type Route } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/selected-record-details.html");
  await expect(page.getByTestId("details")).toBeVisible();
});

test("summary replacements retain loaded details without fetching; identity and explicit refresh fetch again", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/**", route => {
    requests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: { id: String(requests.length), owners: [{ id: "owner" }] } });
  });
  const state = page.getByTestId("details");
  await page.getByRole("button", { name: "Grave A", exact: true }).click();
  await expect(state).toContainText('"id":"1"');
  await page.getByRole("button", { name: "Replace summaries" }).click();
  await expect(state).toContainText('"id":"1"');
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(state).toContainText('"id":"2"');
  await page.getByRole("button", { name: "Other cemetery" }).click();
  await expect(state).toContainText('"id":"3"');
  await page.getByRole("button", { name: "Marker", exact: true }).click();
  await expect(state).toContainText('"marker":{"id":"4"');
  await expect(state).toContainText('"owners":[]');
  await page.getByRole("button", { name: "Replace summaries" }).click();
  await page.getByRole("button", { name: "Other cemetery" }).click();
  await expect(state).toContainText('"marker":{"id":"4"');
  await page.getByRole("button", { name: "Grave A", exact: true }).click();
  await expect(state).toContainText('"grave":{"id":"5"');
  expect(requests).toEqual(["/api/cemeteries/one/grave-spaces/A", "/api/cemeteries/one/grave-spaces/A", "/api/cemeteries/two/grave-spaces/A", "/api/headstones/marker", "/api/cemeteries/one/grave-spaces/A"]);
});

test("preserving refresh retains details on failure, retry clears errors, and selection change clears preserved details", async ({ page }) => {
  let pending: Route | undefined;
  await page.route("**/api/**", route => route.fulfill({ json: { id: "A", owners: [{ id: "owner" }] } }));
  const state = page.getByTestId("details");
  await page.getByRole("button", { name: "Grave A", exact: true }).click();
  await expect(state).toContainText('"id":"A"');
  await page.route("**/api/**", route => { pending = route; });
  await page.getByRole("button", { name: "Preserve refresh" }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(state).toContainText('"loading":true');
  await expect(state).toContainText('"id":"A"');
  await pending!.fulfill({ status: 500, json: { error: "Unavailable" } });
  await expect(state).toContainText('"error":');
  await expect(state).toContainText('"id":"A"');
  pending = undefined;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(state).not.toContainText('"grave":');
  await expect(state).not.toContainText('"error":');
  await pending!.fulfill({ json: { id: "A", owners: [] } });
  await expect(state).toContainText('"loading":false');
  pending = undefined;
  await page.getByRole("button", { name: "Grave B", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(state).not.toContainText('"grave":');
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(state).toHaveText('{"owners":[],"loading":false}');
  await pending!.fulfill({ json: { id: "B", owners: [] } }).catch(() => {});
  await expect(state).toHaveText('{"owners":[],"loading":false}');
});

for (const selection of ["Grave A", "Marker"]) {
  test(`${selection}: summary replacement keeps an in-flight request; changing selection aborts it`, async ({ page }) => {
    const pending: Route[] = [];
    const aborted: string[] = [];
    page.on("requestfailed", request => aborted.push(new URL(request.url()).pathname));
    await page.route("**/api/**", route => { pending.push(route); });
    const state = page.getByTestId("details");
    await page.getByRole("button", { name: selection, exact: true }).click();
    await expect.poll(() => pending.length).toBe(1);
    await page.getByRole("button", { name: "Replace summaries" }).click();
    // A second request would be observed before the subsequent selection request.
    await page.getByRole("button", { name: "Grave B", exact: true }).click();
    await expect.poll(() => pending.length).toBe(2);
    await expect.poll(() => aborted.length).toBe(1);
    expect(aborted[0]).toBe(selection === "Marker" ? "/api/headstones/marker" : "/api/cemeteries/one/grave-spaces/A");
    await pending[1].fulfill({ json: { id: "B", owners: [] } });
    await pending[0].fulfill({ status: 500, json: { error: "Old selection failed" } }).catch(() => {});
    await expect(state).toHaveText('{"grave":{"id":"B","owners":[]},"owners":[],"loading":false}');
  });
}
