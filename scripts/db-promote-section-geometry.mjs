import pg from "pg";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const { Pool } = pg;

function usage() {
  console.error("Usage: npm run db:promote:section-geometry -- --batch-id <uuid> [--facility-id 1] [--sections B,D,F]");
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      usage();
      process.exit(1);
    }

    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for --${key}`);
      process.exit(1);
    }

    options[key] = value;
    index += 1;
  }

  if (!options["batch-id"]) {
    usage();
    process.exit(1);
  }

  return {
    batchId: options["batch-id"],
    facilityId: options["facility-id"] ?? "1",
    sections: String(options.sections ?? "B,D,F")
      .split(",")
      .map((section) => section.trim())
      .filter(Boolean),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.sections.length === 0) throw new Error("At least one section must be supplied.");

  const environment = currentEnvironment();
  const dbEnv = loadDbEnvironment(environment);
  const pool = new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? dbEnv.POSTGRES_PORT ?? 5432),
    database: process.env.PGDATABASE ?? dbEnv.POSTGRES_DB,
    user: process.env.PGUSER ?? dbEnv.POSTGRES_USER,
    password: process.env.PGPASSWORD ?? dbEnv.POSTGRES_PASSWORD,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const stagedResult = await client.query(
      `
        SELECT section_id, ST_Area(geometry::geography) AS area_square_meters
        FROM spatial_import_features
        WHERE batch_id = $1
          AND feature_type = 'section'
          AND facility_id = $2
          AND section_id = ANY($3::text[])
        ORDER BY section_id
      `,
      [options.batchId, options.facilityId, options.sections],
    );

    const stagedSections = new Set(stagedResult.rows.map((row) => row.section_id));
    const missingSections = options.sections.filter((section) => !stagedSections.has(section));
    if (missingSections.length > 0) {
      throw new Error(`Batch ${options.batchId} is missing staged section geometry for: ${missingSections.join(", ")}`);
    }

    const productionResult = await client.query(
      `
        SELECT section.name
        FROM sections section
        JOIN cemeteries cemetery ON cemetery.id = section.cemetery_id
        WHERE cemetery.facility_id = $1
          AND section.name = ANY($2::text[])
          AND section.deleted_at IS NULL
        ORDER BY section.name
      `,
      [options.facilityId, options.sections],
    );
    const productionSections = new Set(productionResult.rows.map((row) => row.name));
    const missingProductionSections = options.sections.filter((section) => !productionSections.has(section));
    if (missingProductionSections.length > 0) {
      throw new Error(`Production sections not found for facility ${options.facilityId}: ${missingProductionSections.join(", ")}`);
    }

    const validationResult = await client.query(
      `
        SELECT issue_code, issue_detail
        FROM spatial_validation_issues
        WHERE severity = 'error'
          AND scope = 'staging'
          AND batch_id = $1
          AND table_name = 'spatial_import_features'
          AND facility_id = $2
          AND section_id = ANY($3::text[])
        ORDER BY issue_code, issue_detail
      `,
      [options.batchId, options.facilityId, options.sections],
    );
    if (validationResult.rows.length > 0) {
      throw new Error(
        `Refusing to promote section geometry because staging validation has errors: ${validationResult.rows
          .map((row) => `${row.issue_code}: ${row.issue_detail}`)
          .join("; ")}`,
      );
    }

    const updateResult = await client.query(
      `
        WITH staged AS (
          SELECT
            feature.facility_id,
            feature.section_id AS section_name,
            ST_Multi(feature.geometry)::geometry(MultiPolygon, 4326) AS geometry
          FROM spatial_import_features feature
          WHERE feature.batch_id = $1
            AND feature.feature_type = 'section'
            AND feature.facility_id = $2
            AND feature.section_id = ANY($3::text[])
        )
        UPDATE sections section
        SET geometry = staged.geometry,
            updated_at = now()
        FROM staged, cemeteries cemetery
        WHERE cemetery.id = section.cemetery_id
          AND cemetery.facility_id = staged.facility_id
          AND section.name = staged.section_name
          AND section.deleted_at IS NULL
        RETURNING section.name, ST_Area(section.geometry::geography) AS area_square_meters
      `,
      [options.batchId, options.facilityId, options.sections],
    );

    await client.query("COMMIT");

    console.log(`Promoted section geometry from spatial batch ${options.batchId}.`);
    for (const row of updateResult.rows) {
      console.log(`Section ${row.name}: ${Number(row.area_square_meters).toFixed(2)} square meters.`);
    }
    console.log(`Sections affected: ${updateResult.rowCount}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
