import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "vite";
import { resolveAppEnvironment } from "../shared/appEnvironment.mjs";

test("explicit environments remain authoritative and invalid labels cannot silently masquerade as DEV", () => {
  for (const environment of ["DEV", "TEST", "STAGE", "PROD"]) {
    assert.equal(resolveAppEnvironment(environment, "test"), environment);
  }
  assert.equal(resolveAppEnvironment(" stage ", "test"), "STAGE");
  assert.equal(resolveAppEnvironment(undefined, "development"), "DEV");
  assert.equal(resolveAppEnvironment(undefined, "production"), "PROD");
  assert.throws(() => resolveAppEnvironment("pr0d", "prod"));
  assert.throws(() => resolveAppEnvironment(undefined, "unknown"));
});

test("real builds without environment files retain mode-derived labels and complete version metadata", async () => {
  const root = mkdtempSync(join(tmpdir(), "frontend-environment-"));
  const previous = process.env.VITE_APP_ENV;
  delete process.env.VITE_APP_ENV;
  try {
    for (const [mode, expected] of [["dev", "DEV"], ["test", "TEST"], ["stage", "STAGE"], ["prod", "PROD"], ["test", "STAGE"]]) {
      const directory = join(root, `${mode}-${expected}`);
      mkdirSync(directory);
      if (mode === "test" && expected === "STAGE") writeFileSync(join(directory, ".env.test"), "VITE_APP_ENV=STAGE\n");
      const output = join(directory, "output");
      await build({
        configFile: false, mode, envDir: directory, logLevel: "silent",
        define: { __APP_VERSION__: JSON.stringify("0.2.1"), __GIT_SHA__: JSON.stringify("fixture-sha"), __BUILD_TIME__: JSON.stringify("2026-11-10T13:00:00Z") },
        build: { outDir: output, emptyOutDir: true, minify: false,
          lib: { entry: resolve("src/config/environment.ts"), formats: ["es"], fileName: () => "environment.mjs" } },
      });
      const built = await import(pathToFileURL(join(output, "environment.mjs")).href);
      assert.equal(built.appEnvironment, expected);
      assert.deepEqual(built.appVersionMetadata, { version: "0.2.1", gitSha: "fixture-sha", buildTime: "2026-11-10T13:00:00Z", environment: expected });
    }
  } finally {
    if (previous === undefined) delete process.env.VITE_APP_ENV;
    else process.env.VITE_APP_ENV = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
