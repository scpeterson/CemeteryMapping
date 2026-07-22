import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const environments = new Set(["dev", "test", "stage", "prod"]);
const authModes = new Set(["disabled", "trusted-header", "auth0"]);

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
  const localEnvPath = resolve(process.cwd(), "db", "env", `${appEnv}.local.env`);
  const fileEnv = {
    ...parseEnvFile(readFileSync(envPath, "utf8")),
    ...(existsSync(localEnvPath) ? parseEnvFile(readFileSync(localEnvPath, "utf8")) : {}),
  };

  const postgresPort = Number(process.env.PGPORT ?? fileEnv.POSTGRES_PORT ?? 5432);
  const apiPort = Number(process.env.API_PORT ?? 3001);
  const authMode = (process.env.AUTH_MODE ?? "disabled").toLowerCase();
  if (!authModes.has(authMode)) {
    throw new Error(`AUTH_MODE must be one of ${[...authModes].join(", ")}. Received "${authMode}".`);
  }
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const auth0Audience = process.env.AUTH0_AUDIENCE;
  if (authMode === "auth0" && (!auth0Domain || !auth0Audience)) {
    throw new Error("AUTH0_DOMAIN and AUTH0_AUDIENCE are required when AUTH_MODE=auth0.");
  }

  return {
    appEnv,
    apiPort,
    auth: {
      mode: authMode,
      subjectHeader: process.env.AUTH_TRUSTED_SUBJECT_HEADER ?? "x-cemetery-user-subject",
      emailHeader: process.env.AUTH_TRUSTED_EMAIL_HEADER ?? "x-cemetery-user-email",
      roleHeader: process.env.AUTH_TRUSTED_ROLE_HEADER ?? "x-cemetery-user-role",
      auth0: {
        domain: auth0Domain,
        audience: auth0Audience,
        issuerBaseUrl: auth0Domain ? `https://${auth0Domain.replace(/^https?:\/\//u, "").replace(/\/$/u, "")}` : undefined,
        management: {
          clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
          clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
          connection: process.env.AUTH0_MANAGEMENT_CONNECTION,
          passwordResetClientId: process.env.AUTH0_PASSWORD_RESET_CLIENT_ID,
        },
      },
    },
    database: {
      host: process.env.PGHOST ?? "127.0.0.1",
      port: postgresPort,
      database: process.env.PGDATABASE ?? fileEnv.POSTGRES_DB,
      user: process.env.PGUSER ?? fileEnv.POSTGRES_USER,
      password: process.env.PGPASSWORD ?? fileEnv.POSTGRES_PASSWORD,
    },
    placeSearch: {
      username: process.env.GEONAMES_USERNAME ?? fileEnv.GEONAMES_USERNAME,
      baseUrl: process.env.GEONAMES_BASE_URL ?? fileEnv.GEONAMES_BASE_URL ?? "https://secure.geonames.org",
      timeoutMs: Number(process.env.GEONAMES_TIMEOUT_MS ?? fileEnv.GEONAMES_TIMEOUT_MS ?? 5000),
    },
  };
}
