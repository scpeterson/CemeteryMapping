import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const environments = new Set(["dev", "test", "stage", "prod"]);

function parseEnvFile(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) return [line, ""];
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

export function loadApiConfig() {
  const appEnv = (process.env.APP_ENV ?? "dev").toLowerCase();
  if (!environments.has(appEnv)) {
    throw new Error(`APP_ENV must be one of ${[...environments].join(", ")}. Received "${appEnv}".`);
  }

  const envPath = resolve(process.cwd(), "db", "env", `${appEnv}.env`);
  const fileEnv = parseEnvFile(readFileSync(envPath, "utf8"));

  const postgresPort = Number(process.env.PGPORT ?? fileEnv.POSTGRES_PORT ?? 5432);
  const apiPort = Number(process.env.API_PORT ?? 3001);

  return {
    appEnv,
    apiPort,
    database: {
      host: process.env.PGHOST ?? "127.0.0.1",
      port: postgresPort,
      database: process.env.PGDATABASE ?? fileEnv.POSTGRES_DB,
      user: process.env.PGUSER ?? fileEnv.POSTGRES_USER,
      password: process.env.PGPASSWORD ?? fileEnv.POSTGRES_PASSWORD,
    },
  };
}
