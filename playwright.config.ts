import { defineConfig, devices } from "@playwright/test";

const appEnv = (process.env.APP_ENV ?? "dev").toLowerCase();
const mode = appEnv === "dev" ? "dev" : appEnv;
const suite = process.env.BROWSER_SUITE ?? "all";
if (!["all", "fixture", "database"].includes(suite)) {
  throw new Error("BROWSER_SUITE must be all, fixture, or database.");
}
const databaseSpecs = "**/app.spec.ts";
const fixtureOnly = suite === "fixture";
const port = fixtureOnly ? 5195 : 5173;
const baseURL = `http://127.0.0.1:${port}`;
const frontend = `VITE_AUTH_MODE=disabled VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA ./node_modules/.bin/vite --mode ${mode} --host 127.0.0.1 --port ${port} --strictPort`;


export default defineConfig({
  testDir: "./tests",
  ...(fixtureOnly ? { testIgnore: databaseSpecs } : {}),
  ...(suite === "database" ? { testMatch: databaseSpecs } : {}),
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: fixtureOnly
      ? `VITE_PROXY_API_TARGET=http://127.0.0.1:9 ${frontend}`
      : `./node_modules/.bin/concurrently -k -s first -n api,web "AUTH_MODE=disabled APP_ENV=${appEnv} node server/index.mjs" "${frontend}"`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
