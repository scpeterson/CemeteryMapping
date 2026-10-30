import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadDbEnvironment } from "./run-liquibase.mjs";

export function localConfig(environment, { runtime = false } = {}) {
  if (!["dev", "test"].includes(environment)) throw new Error("Only local dev and test are supported.");
  const env = loadDbEnvironment(environment);
  if (runtime && !String(env.CEMETERY_API_PASSWORD ?? "").trim()) throw new Error("Runtime API password is required for a representative benchmark.");
  return { host: "127.0.0.1", port: Number(env.POSTGRES_PORT), database: env.POSTGRES_DB,
    user: runtime ? "cemetery_api" : env.POSTGRES_USER,
    password: runtime ? env.CEMETERY_API_PASSWORD : env.POSTGRES_PASSWORD,
    application_name: "cemetery-local-review", connectionTimeoutMillis: 5000,
    statement_timeout: 120000, lock_timeout: 5000 };
}

export async function readOnlyClient(environment) {
  const client = new pg.Client({ ...localConfig(environment), options: "-c default_transaction_read_only=on" });
  await client.connect();
  return client;
}

export function artifactDirectory(prefix, environment) {
  const base = path.resolve("db/backups", prefix);
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  return fs.mkdtempSync(path.join(base, `${environment}-${new Date().toISOString().replaceAll(":", "-")}-`));
}

export function writePrivate(directory, name, data) {
  fs.writeFileSync(path.join(directory, name), typeof data === "string" ? data : `${JSON.stringify(data, null, 2)}\n`,
    { mode: 0o600, flag: "wx" });
}

// Includes all columns of spatial records, not just a lossy GeoJSON rendering.
export async function spatialFingerprint(client) {
  const columns = (await client.query(`SELECT f_table_name AS name FROM geometry_columns
    WHERE f_table_schema='public' GROUP BY f_table_name ORDER BY f_table_name`)).rows;
  const result = {};
  for (const { name } of columns) {
    const identifier = `"${name.replaceAll('"', '""')}"`;
    result[name] = (await client.query(`SELECT count(*)::int AS count,
      md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),'')) AS hash
      FROM public.${identifier} t`)).rows[0];
  }
  return result;
}
