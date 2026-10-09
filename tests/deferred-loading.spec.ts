import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

test("public access form does not download the map application or authentication SDK", async ({ page }) => {
  const appRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/src\/(App\.tsx|components\/(CemeteryMap|DetailPanel)\.tsx|auth\/Auth0AppProvider\.tsx)/u.test(new URL(request.url()).pathname)) appRequests.push(request.url());
  });
  await page.goto("/request-access");
  await expect(page.getByRole("button", { name: "Submit request" })).toBeVisible();
  expect(appRequests).toEqual([]);
});

test("signed-out shell defers map code until sign-in", async ({ page }) => {
  await fixture(page);
  let appRequested = false;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/src/App.tsx") appRequested = true;
  });
  await page.goto("/tests/auth.html?authenticated=false");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(appRequested).toBe(false);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Search cemetery records")).toBeVisible();
  expect(appRequested).toBe(true);
});
