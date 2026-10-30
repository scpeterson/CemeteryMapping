import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Only uniquely named disposable resources: never use the application's DEV/TEST volumes or ports.
const dockerEnv = { ...process.env, APP_ENV: "test", POSTGRES_DB: "upgrade_test", POSTGRES_USER: "upgrade_test",
  POSTGRES_PASSWORD: randomUUID(), POSTGRES_PORT: "0" };

function docker(args, { input, allowFailure = false, binary = false, timeout = 30_000 } = {}) {
  const result = spawnSync("docker", args, { env: dockerEnv, input, encoding: binary ? undefined : "utf8", timeout, maxBuffer: 32 * 1024 * 1024 });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`docker ${args[0]} failed: ${result.error?.message ?? result.stderr?.toString()}`);
  }
  return result;
}

function sql(name, query) {
  return docker(["exec", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "upgrade_test", "-d", "upgrade_test", "-Atc", query]).stdout.trim();
}

async function ready(name) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const logs = docker(["logs", name], { allowFailure: true });
    const output = `${logs.stdout}${logs.stderr}`;
    if (docker(["inspect", "--format", "{{.State.Running}}", name]).stdout.trim() !== "true") throw new Error(output);
    if (output.includes("PostgreSQL init process complete")) {
      const probe = docker(["exec", name, "psql", "-X", "-U", "upgrade_test", "-d", "upgrade_test", "-Atc", "SELECT PostGIS_Version()"], { allowFailure: true });
      if (probe.status === 0) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Database ${name} did not become ready`);
}

test("PostGIS 18 uses the configured mount, preserves data across restart, and safely restores a PostgreSQL 17 dump", { timeout: 360_000 }, async (t) => {
  const config = JSON.parse(docker(["compose", "-f", fileURLToPath(new URL("../docker-compose.yml", import.meta.url)), "config", "--format", "json"]).stdout);
  const { image, volumes } = config.services.db;
  const mount = volumes.find((volume) => volume.type === "volume");
  assert.match(image, /^postgis\/postgis:18-3\.6/u);
  assert.equal(mount.target, "/var/lib/postgresql");
  const prefix = `cemetery-pr748-${randomUUID()}`;
  const containers = [], createdVolumes = [];
  const volume = (suffix) => {
    const name = `${prefix}-${suffix}`;
    docker(["volume", "create", "--label", "cemetery.test=pr748", name]); createdVolumes.push(name); return name;
  };
  const start = (suffix, image, source, target) => {
    const name = `${prefix}-${suffix}`; containers.push(name);
    docker(["run", "--detach", "--platform", "linux/amd64", "--name", name, "--label", "cemetery.test=pr748",
      "-e", "POSTGRES_PASSWORD", "-e", "POSTGRES_DB=upgrade_test", "-e", "POSTGRES_USER=upgrade_test",
      "--mount", `type=volume,source=${source},target=${target}`, image], { timeout: 120_000 });
    return name;
  };
  try {
    const incorrect = start("incorrect-mount", image, volume("incorrect-data"), "/var/lib/postgresql/data");
    assert.equal(docker(["wait", incorrect], { timeout: 15_000 }).stdout.trim(), "1");
    const incorrectLogs = docker(["logs", incorrect]);
    assert.match(`${incorrectLogs.stdout}${incorrectLogs.stderr}`, /unused mount\/volume/u);
    t.diagnostic("Reproduced the empty legacy-mount startup failure.");

    const destination = start("new18", image, volume("new-data"), mount.target);
    await ready(destination);
    assert.match(sql(destination, "SHOW server_version"), /^18\./u);
    assert.match(sql(destination, "SELECT PostGIS_Version()"), /^3\.6/u);
    assert.equal(docker(["exec", destination, "printenv", "PGDATA"]).stdout.trim(), "/var/lib/postgresql/18/docker");
    t.diagnostic("Fresh startup succeeded with the Compose-configured PostgreSQL 18 mount.");

    const oldVolume = volume("old-data");
    const source = start("old17", "postgis/postgis:17-3.5", oldVolume, "/var/lib/postgresql/data");
    await ready(source);
    sql(source, "CREATE TABLE migration_probe(id integer PRIMARY KEY, label text, location geometry(Point,4326)); INSERT INTO migration_probe VALUES(1,'Preserve me',ST_SetSRID(ST_MakePoint(-80,40),4326))");
    const expected = "1|Preserve me|SRID=4326;POINT(-80 40)";
    const query = "SELECT id,label,ST_AsEWKT(location) FROM migration_probe ORDER BY id";
    assert.equal(sql(source, query), expected);
    docker(["stop", source]);

    // Same named volume, new mount root: fail closed instead of initializing an empty 18 cluster over old data.
    const incompatible = start("old-volume-on18", image, oldVolume, mount.target);
    assert.equal(docker(["wait", incompatible], { timeout: 15_000 }).stdout.trim(), "1");
    const incompatibleLogs = docker(["logs", incompatible]);
    assert.match(`${incompatibleLogs.stdout}${incompatibleLogs.stderr}`, /there appears to be PostgreSQL data/u);
    docker(["start", source]); await ready(source);
    assert.equal(sql(source, query), expected);
    t.diagnostic("PostgreSQL 18 refused the old cluster; PostgreSQL 17 reopened it with its data intact.");

    const dump = docker(["exec", source, "pg_dump", "-U", "upgrade_test", "-d", "upgrade_test", "--format=custom", "--no-owner", "--no-acl"], { binary: true }).stdout;
    docker(["exec", "-i", destination, "pg_restore", "-U", "upgrade_test", "-d", "upgrade_test", "--exit-on-error", "--clean", "--if-exists", "--no-owner", "--no-acl"], { input: dump });
    assert.equal(sql(destination, query), expected);
    docker(["restart", destination]); await ready(destination);
    assert.equal(sql(destination, query), expected);
    t.diagnostic("A logical 17→18 restore retained the row and PostGIS geometry across an 18 restart.");
  } finally {
    for (const name of containers.reverse()) docker(["rm", "--force", name], { allowFailure: true });
    for (const name of createdVolumes) docker(["volume", "rm", name], { allowFailure: true });
  }
});
