import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";

if (currentEnvironment() !== "test") throw new Error("Docker startup checks require APP_ENV=test.");
const config = loadDbEnvironment("test");
if (!config.CEMETERY_API_PASSWORD) throw new Error("Run db:configure-api before the Docker startup check.");
const temporary = mkdtempSync(join(tmpdir(), "cemetery-docker-startup-"));
const context = join(temporary, "context");
const name = `cemetery-startup-${randomUUID()}`;
const image = `${name}:test`;
function docker(args, { quiet = false } = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", stdio: quiet ? "pipe" : "inherit", timeout: 600_000 });
  if (result.error || result.status !== 0) throw new Error(`Docker ${args[0]} failed${result.error ? `: ${result.error.message}` : `: ${result.stderr?.trim() || "nonzero exit status"}`}`);
  return result.stdout?.trim();
}
try {
  mkdirSync(context);
  // Build only deployment inputs. Never copy developer environment files or credentials into the image.
  for (const path of ["package.json", "package-lock.json", "server", "shared", "deploy/test/Dockerfile", "deploy/test/Dockerfile.dockerignore"]) {
    cpSync(path, join(context, path), { recursive: true });
  }
  mkdirSync(join(context, "db/env"), { recursive: true });
  const sourceEnv = join(context, "db/env/test.env");
  writeFileSync(sourceEnv, "POSTGRES_DB=startup_check\nPOSTGRES_PASSWORD=unused-build-fixture\n", { mode: 0o600 });
  chmodSync(sourceEnv, 0o600);
  const networks = JSON.parse(docker(["inspect", "--format", "{{json .NetworkSettings.Networks}}", "cemetery-mapping-db-test"], { quiet: true }));
  const network = Object.keys(networks).find((key) => key === "cemeterymapping-test_default");
  if (!network) throw new Error("Start the TEST Compose database before the startup check.");
  const runtimeEnv = join(temporary, "runtime.env");
  const values = {
    APP_ENV: "test", AUTH_MODE: "disabled", API_PORT: "3001", PGHOST: "db", PGPORT: "5432",
    PGDATABASE: config.POSTGRES_DB, PGUSER: "cemetery_api", PGPASSWORD: config.CEMETERY_API_PASSWORD,
  };
  if (Object.values(values).some((value) => /[\r\n]/u.test(value))) throw new Error("Runtime environment values must be single-line.");
  writeFileSync(runtimeEnv, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""), { mode: 0o600 });
  docker(["build", "--file", join(context, "deploy/test/Dockerfile"), "--tag", image, context]);
  // Use the image's default USER and CMD, without publishing a host port.
  docker(["run", "--detach", "--name", name, "--network", network, "--env-file", runtimeEnv, image], { quiet: true });
  docker(["exec", name, "node", "--input-type=module", "-e", `
    import { readFileSync, statSync } from 'node:fs';
    import assert from 'node:assert/strict';
    const file = '/app/db/env/test.env';
    const stat = statSync(file);
    assert.equal(process.getuid(), 1000, 'API must run as node');
    assert.equal(stat.uid, process.getuid(), 'Environment file must belong to the runtime user');
    assert.equal(stat.mode & 0o777, 0o600, 'Environment file must remain private');
    readFileSync(file);
  `], { quiet: true });
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync("docker", ["exec", name, "node", "--input-type=module", "-e", `
      const response = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(2000) });
      const health = await response.json();
      if (!response.ok || health.status !== 'ok' || health.environment !== 'TEST') process.exit(1);
    `], { stdio: "ignore", timeout: 5000 });
    if (result.status === 0) { healthy = true; break; }
    if (docker(["inspect", "--format", "{{.State.Running}}", name], { quiet: true }) !== "true") break;
    await setTimeout(1000);
  }
  if (!healthy) throw new Error("Container did not become healthy within 30 startup attempts.");
  console.log("Docker startup passed: default node user, private readable mode-0600 environment file, and database-backed TEST health response.");
} catch (error) {
  spawnSync("docker", ["logs", "--tail", "80", name], { stdio: "inherit" });
  throw error;
} finally {
  spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
  spawnSync("docker", ["image", "rm", image], { stdio: "ignore" });
  rmSync(temporary, { recursive: true, force: true });
}
