import { spawnSync } from "node:child_process";
import { currentEnvironment, dockerComposeArgs, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const environment = currentEnvironment();

if (environment === "prod") {
  console.error("Refusing to load demo data into PROD.");
  process.exit(1);
}

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
    "/seed/demo-data.sql",
  ],
  {
    env: {
      ...process.env,
      PGPASSWORD: dbEnv.POSTGRES_PASSWORD,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
