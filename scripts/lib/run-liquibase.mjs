import { spawnSync } from "node:child_process";

const liquibaseDefaults = "/liquibase/changelog/liquibase.properties";

export function runLiquibase(args) {
  const result = spawnSync(
    "docker",
    ["compose", "run", "--rm", "liquibase", `--defaults-file=${liquibaseDefaults}`, ...args],
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
