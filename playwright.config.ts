import { defineConfig, devices } from "@playwright/test";

const appEnv = (process.env.APP_ENV ?? "dev").toLowerCase();
const devScript = appEnv === "dev" ? "dev" : `dev:${appEnv}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run ${devScript} -- --host 127.0.0.1 --port 5173`,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
