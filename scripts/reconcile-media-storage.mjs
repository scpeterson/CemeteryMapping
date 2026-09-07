import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { mediaUploadRoot } from "../server/media/mediaMapping.mjs";
import { reconcileMediaStorage } from "../server/media/uploadStorage.mjs";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply")) throw new Error("Usage: node scripts/reconcile-media-storage.mjs [--apply]");
const pool = new pg.Pool(loadApiConfig().database);
try {
  console.log(JSON.stringify(await reconcileMediaStorage(pool, mediaUploadRoot(), { apply: args.includes("--apply") }), null, 2));
} finally { await pool.end(); }
