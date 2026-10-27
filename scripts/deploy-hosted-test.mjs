import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { frontendEnvironment, releaseFiles, requirePassingCi } from "./lib/hosted-test-release.mjs";

const prepareOnly = process.argv.slice(2).join(" ") === "--prepare-only";
if (process.argv.length > 2 && !prepareOnly) throw new Error("Usage: npm run deploy:test -- [--prepare-only]");
const host = "root@67.205.168.195";
const key = process.env.HOSTED_TEST_SSH_KEY ?? join(homedir(), ".ssh/nhcemeteries_test_ed25519");
if (!existsSync(key)) throw new Error("Set HOSTED_TEST_SSH_KEY to the hosted TEST private key.");
const sshArgs = ["-i", key, "-o", "BatchMode=yes"];
const temporary = mkdtempSync(join(tmpdir(), "cemetery-hosted-test-"));
const source = join(temporary, "source");
function run(command, args, { cwd, env, input, capture = false } = {}) {
  const result = spawnSync(command, args, { cwd, env, input, encoding: "utf8", stdio: ["pipe", capture ? "pipe" : "inherit", "inherit"] });
  if (result.error || result.status !== 0) throw new Error(`${command} failed; no deployment steps will be skipped.`);
  return result.stdout?.trim();
}
try {
  run("git", ["fetch", "origin", "main"]);
  const sha = run("git", ["rev-parse", "origin/main"], { capture: true });
  if (!/^[a-f0-9]{40}$/u.test(sha)) throw new Error("Invalid main revision.");
  const checks = JSON.parse(run("gh", ["api", `repos/scpeterson/CemeteryMapping/commits/${sha}/check-runs?per_page=100`], { capture: true }));
  requirePassingCi(checks, sha);
  const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
  const releaseId = `${buildTime.replaceAll(/[-:]/gu, "")}-${sha.slice(0, 12)}-${randomUUID().slice(0, 8)}`;
  const stage = `/srv/nhcemeteries/staging/${releaseId}`;
  console.log(`Preparing hosted TEST ${sha}; recovery files: /srv/nhcemeteries/backups/${releaseId}`);
  mkdirSync(source);
  run("git", ["archive", "--format=tar", `--output=${join(temporary, "source.tar")}`, sha]);
  run("tar", ["-xf", join(temporary, "source.tar"), "-C", source]);
  function removeEnvironmentFiles(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) removeEnvironmentFiles(path);
      else if (entry.name.endsWith(".env") || entry.name.includes(".env.")) rmSync(path);
    }
  }
  removeEnvironmentFiles(source);
  const frontend = run("ssh", [...sshArgs, host, "test -d /srv/nhcemeteries/app/deploy/test && cat /srv/nhcemeteries/app/deploy/test/frontend.env"], { capture: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("VITE_")));
  Object.assign(env, frontendEnvironment(frontend), { GIT_SHA: sha, BUILD_TIME: buildTime });
  run("npm", ["ci", "--include=dev"], { cwd: source });
  run("npm", ["run", "build:test"], { cwd: source, env });
  rmSync(join(source, "node_modules"), { recursive: true, force: true });
  const manifest = { commit: sha, buildTime, files: releaseFiles(source) };
  writeFileSync(join(temporary, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
  const archive = join(temporary, "release.tar.gz");
  // Python tarfile avoids macOS extended attributes and AppleDouble sidecars.
  run("python3", ["-c", "import pathlib,sys,tarfile; root=pathlib.Path(sys.argv[1]); t=tarfile.open(sys.argv[2],'w:gz'); [t.add(root/p,arcname=p,recursive=False) for p in __import__('json').load(open(sys.argv[3]))['files']]; t.close()", source, archive, join(temporary, "manifest.json")]);
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  run("ssh", [...sshArgs, host, `umask 077; mkdir ${stage}`]);
  run("scp", [...sshArgs, archive, join(temporary, "manifest.json"), "deploy/test/release.py", `${host}:${stage}/`]);
  run("ssh", [...sshArgs, host, `python3 ${stage}/release.py ${stage} ${digest}${prepareOnly ? " --prepare-only" : ""}`]);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
