import { defineConfig } from "@playwright/test";
import inspectionRegressions from "./playwright.inspection-regressions.config";

export default defineConfig(inspectionRegressions, {
  testMatch: ["record-options.spec.ts", "marker-sections.spec.ts", "marker-faces.spec.ts", "maintenance-tasks.spec.ts", "offline-fieldwork.spec.ts"],
});
