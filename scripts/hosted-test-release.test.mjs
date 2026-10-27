import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { frontendEnvironment, releaseFiles, requirePassingCi } from "./lib/hosted-test-release.mjs";

test("only successful CI for the selected main commit allows deployment", () => {
  const passing = { name: "Lint, build, and test", head_sha: "selected", status: "completed", conclusion: "success" };
  requirePassingCi({ check_runs: [passing] }, "selected");
  for (const checks of [[], [{ ...passing, head_sha: "previous" }], [{ ...passing, status: "in_progress" }], [{ ...passing, conclusion: "failure" }]]) {
    assert.throws(() => requirePassingCi({ check_runs: checks }, "selected"));
  }
});

test("frontend settings preserve hosted public values and reject server secrets", () => {
  const contents = 'VITE_AUTH0_DOMAIN=hosted.example\nVITE_AUTH0_CLIENT_ID="test-client"\nVITE_AUTH0_AUDIENCE=test-api\n';
  assert.equal(frontendEnvironment(contents).VITE_AUTH0_CLIENT_ID, "test-client");
  assert.throws(() => frontendEnvironment(`${contents}POSTGRES_PASSWORD=secret`));
  assert.throws(() => frontendEnvironment("VITE_AUTH0_DOMAIN=hosted.example"));
});

test("release manifest detects changed files and excludes env files and symbolic links", () => {
  const root = mkdtempSync(join(tmpdir(), "hosted-release-test-"));
  try {
    mkdirSync(join(root, "server"));
    const file = join(root, "server/index.mjs");
    writeFileSync(file, "original");
    const original = releaseFiles(root);
    writeFileSync(file, "changed");
    assert.notEqual(releaseFiles(root)["server/index.mjs"], original["server/index.mjs"]);
    for (const filename of ["runtime.env", ".env.test.local"]) {
      writeFileSync(join(root, filename), "private");
      assert.throws(() => releaseFiles(root), /environment file/u);
      rmSync(join(root, filename));
    }
    symlinkSync(file, join(root, "linked"));
    assert.throws(() => releaseFiles(root), /symbolic link/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
