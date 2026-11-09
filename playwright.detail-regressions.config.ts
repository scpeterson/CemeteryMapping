import { defineConfig } from "@playwright/test";
import inspectionRegressions from "./playwright.inspection-regressions.config";

// Reuse the isolated, database-free server for detail selection and editing checks.
export default defineConfig(inspectionRegressions, {
  testMatch: [
    "selected-record-details.spec.ts", "targeted-mutations.spec.ts", "improvements.spec.ts",
    "overview.spec.ts", "grave-lot-assignment.spec.ts", "edit-ownership.spec.ts",
    "marker-overview-actions.spec.ts", "saved-drafts.spec.ts", "record-photos.spec.ts",
  ],
});
