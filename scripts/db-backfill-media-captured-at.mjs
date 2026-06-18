import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pg from "pg";
import { setAuditContext } from "../server/auditContext.mjs";
import { loadApiConfig } from "../server/config.mjs";
import { capturedAtFromExif } from "../server/mediaExif.mjs";

const { Pool } = pg;

function usage() {
  return [
    "Usage: node scripts/db-backfill-media-captured-at.mjs [--apply] [--missing-only] [--limit N]",
    "",
    "Reads existing local photo files and backfills media_assets.captured_at from JPEG EXIF.",
    "Without --apply, the script only reports what would change.",
    "--missing-only updates only rows where captured_at is currently NULL.",
  ].join("\n");
}

function optionsFromArgv(argv) {
  const options = {
    apply: false,
    missingOnly: false,
    limit: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--missing-only") {
      options.missingOnly = true;
      continue;
    }
    if (arg === "--limit") {
      const value = argv[index + 1];
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== value) {
        throw new Error("--limit must be a positive integer.");
      }
      options.limit = parsed;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n${usage()}`);
  }

  return options;
}

function mediaUploadRoot() {
  return process.env.MEDIA_UPLOAD_DIR ? resolve(process.env.MEDIA_UPLOAD_DIR) : resolve(process.cwd(), "uploads", "media");
}

function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function loadPhotoRows(pool, { missingOnly, limit }) {
  const values = [];
  const filters = ["asset_type = 'photo'", "deleted_at IS NULL"];
  if (missingOnly) filters.push("captured_at IS NULL");
  let limitSql = "";
  if (limit) {
    values.push(limit);
    limitSql = `LIMIT $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        id::text,
        storage_key,
        original_filename,
        content_type,
        captured_at
      FROM media_assets
      WHERE ${filters.join(" AND ")}
      ORDER BY uploaded_at, id
      ${limitSql}
    `,
    values,
  );
  return result.rows;
}

async function backfillCapturedAt(pool, rows, { apply }) {
  const uploadRoot = mediaUploadRoot();
  const summary = {
    uploadRoot,
    scanned: rows.length,
    alreadyMatched: 0,
    missingExif: 0,
    missingFile: 0,
    failed: 0,
    wouldUpdate: 0,
    updated: 0,
    samples: [],
  };

  const updates = [];

  for (const row of rows) {
    let bytes;
    try {
      bytes = await readFile(join(uploadRoot, row.storage_key));
    } catch (error) {
      if (error?.code === "ENOENT") {
        summary.missingFile += 1;
        continue;
      }
      summary.failed += 1;
      summary.samples.push({ id: row.id, storageKey: row.storage_key, error: error instanceof Error ? error.message : String(error) });
      continue;
    }

    const capturedAt = capturedAtFromExif({ bytes, contentType: row.content_type });
    if (!capturedAt) {
      summary.missingExif += 1;
      continue;
    }

    if (isoDate(row.captured_at) === capturedAt) {
      summary.alreadyMatched += 1;
      continue;
    }

    updates.push({ id: row.id, storageKey: row.storage_key, currentCapturedAt: isoDate(row.captured_at), capturedAt });
    if (summary.samples.length < 10) summary.samples.push(updates.at(-1));
  }

  summary.wouldUpdate = updates.length;
  if (!apply || updates.length === 0) return summary;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, {
      reason: "Backfill media captured_at from photo EXIF",
      source: "script",
    });
    for (const update of updates) {
      const result = await client.query(
        `
          UPDATE media_assets
          SET captured_at = $2::timestamptz
          WHERE id = $1
            AND deleted_at IS NULL
            AND captured_at IS DISTINCT FROM $2::timestamptz
        `,
        [update.id, update.capturedAt],
      );
      summary.updated += result.rowCount;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return summary;
}

const options = optionsFromArgv(process.argv.slice(2));
const config = loadApiConfig();
const pool = new Pool(config.database);

try {
  const rows = await loadPhotoRows(pool, options);
  const summary = await backfillCapturedAt(pool, rows, options);
  console.log(
    JSON.stringify(
      {
        environment: config.appEnv,
        mode: options.apply ? "apply" : "dry-run",
        missingOnly: options.missingOnly,
        ...summary,
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
