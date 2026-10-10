import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";

// Keep the widget deterministic and offline while exercising real form token handling.
test.beforeEach(async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", (route) => route.fulfill({ contentType: "application/javascript", body: `
    let sequence = 0;
    const callbacks = new Map(); const containers = new Map();
    window.turnstile = {
      render(container, options) {
        const id = String(++sequence); callbacks.set(id, options); containers.set(id, container);
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Complete verification';
        button.onclick = () => options.callback('token-' + (++sequence)); container.append(button);
        const expire = document.createElement('button'); expire.type = 'button'; expire.textContent = 'Expire verification';
        expire.onclick = () => options['expired-callback'](); container.append(expire);
        return id;
      },
      reset(id) { callbacks.get(id)?.['expired-callback'](); },
      remove(id) { callbacks.delete(id); containers.get(id)?.replaceChildren(); containers.delete(id); }
    };
  ` }));
  await page.route("**/api/admin/access-request-stats", (route) => route.fulfill({ json: { pending: 0, lastHour: 0, limits: { pending: 200, hourly: 100 } } }));
});

async function verify(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Complete verification" }).click();
}

for (const width of [390, 1280]) {
  test(`public request form submits without fetching cemetery records at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    const requests: string[] = [];
    page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(new URL(request.url()).pathname); });
    let submitted: Record<string, unknown> = {};
    await page.route("**/api/access-requests", (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 202, json: { message: "Your request has been received. An administrator will review it." } });
    });
    await page.goto("/request-access");
    await page.getByLabel("Your name", { exact: true }).fill("Demo Visitor");
    await page.getByLabel("Email", { exact: true }).fill("visitor@example.test");
    await page.getByLabel("Cemetery of interest").fill("Fictional Cemetery");
    await page.getByLabel("Why would you like access?").fill("Historical research");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`request-access-${width}.png`), fullPage: true });
    await expect(page.getByRole("button", { name: "Submit request" })).toBeDisabled();
    await verify(page);
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("status")).toContainText("An administrator will review it");
    expect(submitted.turnstileToken).toMatch(/^token-/);
    expect(submitted.email).toBe("visitor@example.test");
    expect(submitted).not.toHaveProperty("role");
    expect(requests).toEqual(["/api/access-requests"]);
  });
}

test("failed requests keep the form and allow retry", async ({ page }) => {
  await page.route("**/api/access-requests", (route) => route.fulfill({ status: 429, json: { error: "Try later" } }));
  await page.goto("/request-access");
  await page.getByLabel("Your name", { exact: true }).fill("Visitor");
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.test");
  await page.getByLabel("Cemetery of interest").fill("Fictional");
  await page.getByLabel("Why would you like access?").fill("Research");
  await verify(page);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many requests");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Visitor");
  await expect(page.getByRole("button", { name: "Submit request" })).toBeDisabled();
  await verify(page);
  await expect(page.getByRole("button", { name: "Submit request" })).toBeEnabled();
});

test("admin reviews a request through user setup defaulting to reader", async ({ page }) => {
  await page.route("**/api/**", (route) => new URL(route.request().url()).pathname.startsWith("/api/")
    ? route.fulfill({ status: 403, json: { error: "Outside this test fixture" } }) : route.fallback());
  await fixture(page);
  const request = { id: "11111111-1111-4111-8111-111111111111", email: "visitor@example.test", displayName: "Demo Visitor", cemeteryInterest: "Fictional", reason: "Research", createdAt: "2026-09-29T12:00:00Z", status: "pending" };
  let approved = false;
  await page.route("**/api/admin/cemetery-records", (route) => route.fulfill({ json: { cemeteries: [], sections: [], lots: [] } }));
  await page.route("**/api/admin/access-request-stats", (route) => route.fulfill({ json: { pending: 1, lastHour: 1, limits: { pending: 200, hourly: 100 } } }));
  await page.route("**/api/admin/access-requests", (route) => route.fulfill({ json: approved ? [] : [request] }));
  await page.route("**/api/admin/roles", (route) => route.fulfill({ json: [{ name: "reader", description: "Read-only", userCount: 0 }, { name: "admin", description: "Admin", userCount: 1 }] }));
  await page.route("**/api/admin/auth0-users/resolve", (route) => route.fulfill({ json: { externalSubject: "auth0|visitor", email: request.email, displayName: request.displayName, created: true, invitationSent: true } }));
  await page.route("**/api/admin/users", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    const body = route.request().postDataJSON();
    expect(body.role).toBe("reader"); expect(body.accessRequestId).toBe(request.id);
    approved = true;
    return route.fulfill({ status: 201, json: { ...body, id: "new-user", createdAt: "2026-09-29" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Open administration:/ }).click();
  const admin = page.getByRole("dialog", { name: "Admin management" });
  await admin.getByRole("button", { name: "Users", exact: true }).click();
  await admin.getByRole("button", { name: "Set up user" }).click();
  await expect(admin.getByRole("combobox", { name: "Role", exact: true })).toHaveValue("reader");
  await admin.getByRole("button", { name: "Save user", exact: true }).click();
  await expect(admin).toContainText("Access request approved");
  await expect(admin).toContainText("No pending requests");
});

test("expired verification blocks submission until a new token is issued", async ({ page }) => {
  await page.goto("/request-access");
  const submit = page.getByRole("button", { name: "Submit request" });
  await verify(page); await expect(submit).toBeEnabled();
  await page.getByRole("button", { name: "Expire verification" }).click();
  await expect(submit).toBeDisabled();
  await verify(page); await expect(submit).toBeEnabled();
});

test("failed widget download can be retried without losing entered details", async ({ page }) => {
  let first = true;
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", (route) => {
    if (first) { first = false; return route.abort(); }
    return route.fallback();
  });
  await page.goto("/request-access");
  await page.getByLabel("Your name", { exact: true }).fill("Visitor");
  await expect(page.getByRole("button", { name: "Submit request" })).toBeDisabled();
  await page.getByRole("button", { name: "Retry verification" }).click();
  await verify(page);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Visitor");
  await expect(page.getByRole("button", { name: "Submit request" })).toBeEnabled();
});
