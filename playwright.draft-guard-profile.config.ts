import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/performance", testMatch: "draft-guard.profile.ts", workers: 1, reporter: "list",
  use: { baseURL: "http://127.0.0.1:5200" },
  webServer: { command: `./node_modules/.bin/vite preview --outDir node_modules/.tmp/draft-guard-profile/${process.env.DRAFT_PROFILE_VARIANT ?? "before"} --host 127.0.0.1 --port 5200 --strictPort`, url: "http://127.0.0.1:5200/tests/draft-guard.html", reuseExistingServer: false },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
