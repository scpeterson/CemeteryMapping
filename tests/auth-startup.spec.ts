import { expect, test } from "@playwright/test";

test("initial authenticated child requests include the token, including StrictMode remount", async ({ page }) => {
  const headers: (string | undefined)[] = [];
  await page.route("**/auth-startup-probe", async (route) => {
    headers.push(route.request().headers().authorization);
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/tests/fixtures/auth-startup.html");
  await expect.poll(() => headers.length).toBe(2);
  expect(headers).toEqual(["Bearer startup-test-token", "Bearer startup-test-token"]);
});
