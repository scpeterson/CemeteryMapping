import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { runSystemEventRetentionPurgeJob } from "../server/retentionJobs.mjs";

const { Pool } = pg;

const config = loadApiConfig();
const pool = new Pool(config.database);

try {
  const result = await runSystemEventRetentionPurgeJob(pool, {
    trigger: "script",
    environment: config.appEnv,
  });
  console.log(
    JSON.stringify(
      {
        environment: config.appEnv,
        ...result,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
