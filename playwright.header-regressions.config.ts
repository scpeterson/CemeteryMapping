import { defineConfig } from "@playwright/test";
import inspectionRegressions from "./playwright.inspection-regressions.config";

// Mocked API fixtures on the isolated web server; leave running DEV services/data alone.
export default defineConfig({
  ...inspectionRegressions,
  testMatch: ["application-header.spec.ts", "whats-new.spec.ts", "ui.spec.ts"],
  webServer: {
    command: 'VITE_PROXY_API_TARGET=http://127.0.0.1:9 VITE_AUTH_MODE=disabled VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA ./node_modules/.bin/vite --mode dev --host 127.0.0.1 --port 5199 --strictPort',
    url: "http://127.0.0.1:5199",
    reuseExistingServer: false,
  },
});
