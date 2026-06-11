import pg from "pg";
import { purgeAuditEvents } from "../server/auditRepository.mjs";
import { loadApiConfig } from "../server/config.mjs";

const { Pool } = pg;

const config = loadApiConfig();
const pool = new Pool(config.database);

try {
  const result = await purgeAuditEvents(pool);
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
