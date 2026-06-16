import { defineConfig, devices } from "@playwright/test";

const appEnv = (process.env.APP_ENV ?? "dev").toLowerCase();
const mode = appEnv === "dev" ? "dev" : appEnv;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: `./node_modules/.bin/concurrently -k -s first -n api,web "AUTH_MODE=disabled APP_ENV=${appEnv} node server/index.mjs" "VITE_AUTH_MODE=disabled ./node_modules/.bin/vite --mode ${mode} --host 127.0.0.1 --port 5173 --strictPort"`,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
