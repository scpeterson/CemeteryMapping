import { defineConfig } from "@playwright/test";
import inspectionRegressions from "./playwright.inspection-regressions.config";

// All API writes stay in mocked fixtures. Never reuse a running DEV/TEST server.
export default defineConfig({
  ...inspectionRegressions,
  workers: 2,
  testMatch: [
    "ownership-map-refresh.spec.ts", "targeted-mutations.spec.ts", "passageways.spec.ts", "grave-stacks.spec.ts", "ui-consistency.spec.ts", "admin-ui-fixes.spec.ts", "ui.spec.ts", "admin-layout.spec.ts",
    "application-header.spec.ts", "auth-layout.spec.ts", "map-controls.spec.ts",
    "inspection-face-status.spec.ts", "grave-feature-lookups.spec.ts", "military-rank-lookups.spec.ts",
    "unreadable-inscriptions-report.spec.ts", "record-exports.spec.ts",
    "maintenance-tasks.spec.ts", "offline-fieldwork.spec.ts", "access-requests.spec.ts",
    "user-profiles.spec.ts", "record-photos.spec.ts", "edit-ownership.spec.ts",
    "burial-date-validation.spec.ts", "source-people-layout.spec.ts",
    "readings-detail-layout.spec.ts", "bulk-layout.spec.ts",
  ],
  use: { ...inspectionRegressions.use, baseURL: "http://127.0.0.1:5197" },
  webServer: {
    command: 'VITE_PROXY_API_TARGET=http://127.0.0.1:9 VITE_AUTH_MODE=disabled VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA ./node_modules/.bin/vite --mode dev --host 127.0.0.1 --port 5197 --strictPort',
    url: "http://127.0.0.1:5197",
    reuseExistingServer: false,
  },
});
