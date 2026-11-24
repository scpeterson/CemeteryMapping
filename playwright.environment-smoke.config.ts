import { defineConfig } from "@playwright/test";
import browserChecks from "./playwright.ui-consistency.config";

// Isolated fixture-backed workflows; never start an API or connect to a live DB.
export default defineConfig({
  ...browserChecks,
  testMatch: ["offline-fieldwork.spec.ts", "multiple-photo-upload.spec.ts", "record-photos.spec.ts"],
  workers: 2,
  use: { ...browserChecks.use, baseURL: "http://127.0.0.1:5198" },
  webServer: {
    command: "VITE_AUTH_MODE=disabled VITE_PROXY_API_TARGET=http://127.0.0.1:9 ./node_modules/.bin/vite build --mode test --outDir .runtime/workflow-smoke/dist && VITE_AUTH_MODE=disabled VITE_PROXY_API_TARGET=http://127.0.0.1:9 ./node_modules/.bin/vite preview --mode test --outDir .runtime/workflow-smoke/dist --host 127.0.0.1 --port 5198 --strictPort",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: false,
  },
});
