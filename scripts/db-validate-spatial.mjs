import { spawnSync } from "node:child_process";
import { currentEnvironment, dockerComposeArgs, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const environment = currentEnvironment();
const dbEnv = loadDbEnvironment(environment);

const result = spawnSync(
  "docker",
  [
    ...dockerComposeArgs(environment),
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    dbEnv.POSTGRES_USER,
    "-d",
    dbEnv.POSTGRES_DB,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "/validation/spatial-validation.sql",
  ],
  {
    env: {
      ...process.env,
      PGPASSWORD: dbEnv.POSTGRES_PASSWORD,
    },
    encoding: "utf8",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);

const countResult = spawnSync(
  "docker",
  [
    ...dockerComposeArgs(environment),
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    dbEnv.POSTGRES_USER,
    "-d",
    dbEnv.POSTGRES_DB,
    "-t",
    "-A",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "SELECT count(*) FROM spatial_validation_issues;",
  ],
  {
    env: {
      ...process.env,
      PGPASSWORD: dbEnv.POSTGRES_PASSWORD,
    },
    encoding: "utf8",
  },
);

if (countResult.error) {
  console.error(countResult.error.message);
  process.exit(1);
}

if (countResult.stderr) process.stderr.write(countResult.stderr);
if (countResult.status !== 0) process.exit(countResult.status ?? 1);

const issueCount = Number.parseInt(countResult.stdout.trim(), 10);
if (issueCount > 0) {
  console.error(`Spatial validation failed with ${issueCount} issue${issueCount === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log("Spatial validation passed with 0 issues.");
