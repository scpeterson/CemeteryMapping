import { defineConfig } from "@playwright/test";
import inspectionRegressions from "./playwright.inspection-regressions.config";

export default defineConfig(inspectionRegressions, {
  testMatch: [
    "map-highlighting.spec.ts", "map-status-filter.spec.ts", "map-layer-errors.spec.ts",
    "map-worker.spec.ts", "map-controls.spec.ts", "stable-scoped-collections.spec.ts",
    "section-cemetery-scope.spec.ts", "scoped-local-search.spec.ts",
    "ux-navigation.spec.ts", "improvements.spec.ts",
  ],
});
