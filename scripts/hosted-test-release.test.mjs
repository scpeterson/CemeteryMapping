import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { deploymentOptions, frontendEnvironment, releaseFiles, requirePassingCi, selectReleaseCommit } from "./lib/hosted-test-release.mjs";

test("deployment arguments accept exact releases and reject ambiguous or unsafe inputs", () => {
  assert.deepEqual(deploymentOptions([]), { prepareOnly: false, ref: null });
  assert.deepEqual(deploymentOptions(["--prepare-only", "--ref", "v0.2.0"]), { prepareOnly: true, ref: "v0.2.0" });
  assert.equal(deploymentOptions(["--ref", "a".repeat(40)]).ref, "a".repeat(40));
  for (const args of [["--ref"], ["--ref", "main"], ["--ref", "abc123"], ["--ref", "--help"], ["--ref", "v0.2.0;id"], ["--prepare-only", "--prepare-only"], ["--ref", "v0.2.0", "--ref", "v0.3.0"]]) {
    assert.throws(() => deploymentOptions(args));
  }
});

test("release selection pins an older annotated tag after main advances and rejects non-main or mismatched releases", () => {
  const root = mkdtempSync(join(tmpdir(), "release-selection-"));
  const upstream = join(root, "upstream");
  const checkout = join(root, "checkout");
  const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    mkdirSync(upstream);
    git(upstream, ["init", "-b", "main"]);
    git(upstream, ["config", "user.name", "Release fixture"]);
    git(upstream, ["config", "user.email", "release@example.com"]);
    const commit = (version) => {
      writeFileSync(join(upstream, "package.json"), JSON.stringify({ version }));
      git(upstream, ["add", "package.json"]);
      git(upstream, ["commit", "-m", version]);
      return git(upstream, ["rev-parse", "HEAD"]);
    };
    const release = commit("0.2.0");
    git(upstream, ["tag", "-a", "v0.2.0", "-m", "Release"]);
    git(upstream, ["tag", "v9.0.0"]);
    const latest = commit("0.3.0");
    git(upstream, ["switch", "-c", "unmerged"]);
    const unmerged = commit("0.4.0");
    git(upstream, ["switch", "main"]);
    git(root, ["clone", upstream, checkout]);
    const run = (command, args) => {
      assert.equal(command, "git");
      return git(checkout, args);
    };
    assert.equal(selectReleaseCommit(run, null), latest);
    assert.equal(selectReleaseCommit(run, "v0.2.0"), release);
    assert.equal(selectReleaseCommit(run, release), release);
    assert.throws(() => selectReleaseCommit(run, unmerged));
    assert.throws(() => selectReleaseCommit(run, "v9.0.0"), /package version/u);
    assert.throws(() => selectReleaseCommit(run, "v8.0.0"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

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
