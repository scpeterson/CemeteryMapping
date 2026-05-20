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
    command: `concurrently -k -s first -n api,web "APP_ENV=${appEnv} node server/index.mjs" "VITE_AUTH0_DOMAIN= VITE_AUTH0_CLIENT_ID= VITE_AUTH0_AUDIENCE= vite --mode ${mode} --host 127.0.0.1 --port 5173 --strictPort"`,
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
