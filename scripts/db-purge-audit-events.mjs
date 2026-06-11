import pg from "pg";
import { purgeAuditEvents } from "../server/auditRepository.mjs";
import { loadApiConfig } from "../server/config.mjs";
import { safelyRecordSystemEvent } from "../server/systemEventRepository.mjs";

const { Pool } = pg;

const config = loadApiConfig();
const pool = new Pool(config.database);
const jobSource = "db:purge:audit";
const startedAt = Date.now();

try {
  await safelyRecordSystemEvent(pool, {
    eventType: "job_run",
    severity: "info",
    source: jobSource,
    status: "started",
    message: "Audit retention purge started.",
    environment: config.appEnv,
  });

  const result = await purgeAuditEvents(pool);
  const durationMs = Date.now() - startedAt;
  await safelyRecordSystemEvent(pool, {
    eventType: "job_run",
    severity: "info",
    source: jobSource,
    status: "succeeded",
    message: `Audit retention purge completed. Deleted ${result.deletedCount} event${result.deletedCount === 1 ? "" : "s"}.`,
    durationMs,
    environment: config.appEnv,
    metadata: result,
  });
  console.log(
    JSON.stringify(
      {
        environment: config.appEnv,
        durationMs,
        ...result,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await safelyRecordSystemEvent(pool, {
    eventType: "job_run",
    severity: "error",
    source: jobSource,
    status: "failed",
    message: error instanceof Error ? error.message : "Audit retention purge failed.",
    detail: error instanceof Error ? error.stack : String(error),
    durationMs: Date.now() - startedAt,
    environment: config.appEnv,
  });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
