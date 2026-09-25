import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { currentEnvironment, loadDbEnvironment, localEnvFilePath } from "./lib/run-liquibase.mjs";

const environment = currentEnvironment();
if (!["dev", "test"].includes(environment)) throw new Error("This command configures local DEV or TEST only. Use the hosted runbook for deployments.");
const config = loadDbEnvironment(environment);
const path = localEnvFilePath(environment);
const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
const password = config.CEMETERY_API_PASSWORD ?? randomBytes(32).toString("hex");
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const setup = readFileSync(new URL("../deploy/test/configure-api-role.sh", import.meta.url), "utf8");
// Secrets travel over stdin, never in command arguments or console output.
const input = Object.entries({ CEMETERY_API_PASSWORD: password, POSTGRES_USER: config.POSTGRES_USER,
  POSTGRES_DB: config.POSTGRES_DB, POSTGRES_PASSWORD: config.POSTGRES_PASSWORD })
  .map(([key, value]) => `export ${key}=${quote(value)}`).join("\n") + "\n" + setup;
const result = spawnSync("docker", ["exec", "-i", `cemetery-mapping-db-${environment}`, "sh"], { input, encoding: "utf8" });
if (result.status !== 0) throw new Error("API role setup failed; local runtime configuration was not changed. Check that the local database is running and migrated.");
const lines = previous.split(/\r?\n/u).filter((line) => !line.startsWith("CEMETERY_API_PASSWORD="));
writeFileSync(path, `${lines.join("\n").trimEnd()}\nCEMETERY_API_PASSWORD=${password}\n`, { mode: 0o600 });
chmodSync(path, 0o600);
console.log(`${environment.toUpperCase()}: restricted cemetery_api account configured; administrative credentials retained for migrations. Restart the API to apply.`);
