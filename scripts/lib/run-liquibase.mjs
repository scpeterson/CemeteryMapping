import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const liquibaseDefaults = "/liquibase/changelog/liquibase.properties";
const environments = new Set(["dev", "test", "stage", "prod"]);

export function currentEnvironment() {
  const requested = process.env.APP_ENV?.toLowerCase() ?? "dev";

  if (!environments.has(requested)) {
    console.error(`APP_ENV must be one of: ${Array.from(environments).join(", ")}`);
    process.exit(1);
  }

  return requested;
}

export function envFilePath(environment = currentEnvironment()) {
  return resolve(`db/env/${environment}.env`);
}

export function localEnvFilePath(environment = currentEnvironment()) {
  return resolve(`db/env/${environment}.local.env`);
}

function readEnvFile(envFile, required = true) {
  if (!required && !existsSync(envFile)) return {};

  const values = {};

  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }

  return values;
}

export function loadDbEnvironment(environment = currentEnvironment()) {
  return {
    ...readEnvFile(envFilePath(environment)),
    ...readEnvFile(localEnvFilePath(environment), false),
  };
}

export function dockerComposeArgs(environment = currentEnvironment()) {
  const args = ["compose", "-p", `cemeterymapping-${environment}`, "--env-file", envFilePath(environment)];
  const localEnvFile = localEnvFilePath(environment);

  if (existsSync(localEnvFile)) {
    args.push("--env-file", localEnvFile);
  }

  return args;
}

export function runLiquibase(args) {
  const environment = currentEnvironment();
  const dbEnv = loadDbEnvironment(environment);
  const url = `jdbc:postgresql://db:5432/${dbEnv.POSTGRES_DB}`;

  const result = spawnSync(
    "docker",
    [
      ...dockerComposeArgs(environment),
      "run",
      "--rm",
      "liquibase",
      `--defaults-file=${liquibaseDefaults}`,
      `--url=${url}`,
      `--username=${dbEnv.POSTGRES_USER}`,
      `--password=${dbEnv.POSTGRES_PASSWORD}`,
      ...args,
    ],
    {
      stdio: "inherit",
    },
  );

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

export function requireArgument(value, usage) {
  if (!value) {
    console.error(usage);
    process.exit(1);
  }

  return value;
}

export function parsePositiveInteger(value, fallback) {
  const candidate = value ?? fallback;
  const parsed = Number.parseInt(candidate, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== String(candidate)) {
    console.error("Rollback count must be a positive integer.");
    process.exit(1);
  }

  return String(parsed);
}
