import { defineConfig } from "@playwright/test";
import inspections from "./playwright.inspection-regressions.config";
export default defineConfig(inspections, {
  testMatch: [...(inspections.testMatch as string[]), "draft-guard.spec.ts", "improvements.spec.ts", "maintenance-tasks.spec.ts", "cemetery-members.spec.ts", "user-profiles.spec.ts"],
});
