import { parseArgs } from "node:util";
import pg from "pg";
import { localConfig } from "./lib/local-db-review.mjs";

const { values } = parseArgs({ options: { env: { type: "string", default: "dev" },
  limit: { type: "string", default: "20" }, "include-query-text": { type: "boolean", default: false } } });
const limit = Number(values.limit);
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100.");
const client = new pg.Client({ ...localConfig(values.env), options: "-c default_transaction_read_only=on" });
try {
  await client.connect();
  const ready = (await client.query(`SELECT current_setting('shared_preload_libraries') LIKE '%pg_stat_statements%' AS preloaded,
    to_regclass('diagnostics.pg_stat_statements') IS NOT NULL AS installed`)).rows[0];
  if (!ready.preloaded || !ready.installed) throw new Error("Query statistics require the database restart configured in Compose and migration 512. See docs/postgresql-18-upgrade.md.");
  const { rows } = await client.query(`SELECT queryid::text, calls::text,
    round(total_exec_time::numeric,2) AS total_exec_ms, round(mean_exec_time::numeric,2) AS mean_exec_ms,
    rows::text, shared_blks_hit::text, shared_blks_read::text, temp_blks_written::text
    ${values["include-query-text"] ? ", query" : ""}
    FROM diagnostics.pg_stat_statements
    WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
      AND userid=(SELECT oid FROM pg_roles WHERE rolname='cemetery_api')
    ORDER BY total_exec_time DESC,queryid LIMIT $1`, [limit]);
  console.log(JSON.stringify({ environment: values.env, runtimeRole: "cemetery_api", statements: rows }, null, 2));
} finally { await client.end(); }
