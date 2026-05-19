import pg from "pg";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const { Pool } = pg;

function usage() {
  console.error("Usage: npm run db:promote:spatial -- [--batch-id <uuid>]");
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

  return options;
}

async function resolveBatchId(client, requestedBatchId) {
  if (requestedBatchId) return requestedBatchId;

  const result = await client.query(`
    SELECT id
    FROM spatial_import_batches
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `);

  const batchId = result.rows[0]?.id;
  if (!batchId) {
    throw new Error("No spatial import batches found.");
  }

  return batchId;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
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
    const batchId = await resolveBatchId(client, options["batch-id"]);

    const errorResult = await client.query(
      `
        SELECT count(*)::int AS count
        FROM spatial_validation_issues
        WHERE severity = 'error'
          AND scope = 'staging'
          AND batch_id = $1
      `,
      [batchId],
    );

    if (errorResult.rows[0].count > 0) {
      throw new Error(`Refusing to promote batch ${batchId}: spatial validation has ${errorResult.rows[0].count} staging error(s).`);
    }

    const cemeteryResult = await client.query(
      `
        WITH staged AS (
          SELECT
            feature.facility_id,
            lower_properties.properties,
            ST_Multi(geometry)::geometry(MultiPolygon, 4326) AS geometry
          FROM spatial_import_features feature
          CROSS JOIN LATERAL (
            SELECT jsonb_object_agg(lower(entry.key), entry.value) AS properties
            FROM jsonb_each(feature.source_properties) entry
          ) lower_properties
          WHERE feature.batch_id = $1
            AND feature.feature_type = 'cemetery'
        )
        INSERT INTO cemeteries (
          facility_id,
          name,
          full_address,
          municipality,
          agency,
          agency_url,
          owned_by,
          maintained_by,
          operational_hours,
          contact_name,
          contact_phone,
          contact_email,
          earliest_burial_year,
          image_url,
          notes,
          geometry,
          updated_at
        )
        SELECT
          staged.facility_id,
          COALESCE(staged.properties ->> 'name', 'Imported cemetery'),
          staged.properties ->> 'fulladdr',
          staged.properties ->> 'municipality',
          staged.properties ->> 'agency',
          staged.properties ->> 'agencyurl',
          NULLIF(staged.properties ->> 'ownedby', '')::smallint,
          NULLIF(staged.properties ->> 'maintby', '')::smallint,
          staged.properties ->> 'operhours',
          staged.properties ->> 'pocname',
          staged.properties ->> 'pocphone',
          staged.properties ->> 'pocemail',
          NULLIF(staged.properties ->> 'earliest', '')::smallint,
          staged.properties ->> 'imageurl',
          staged.properties ->> 'notes',
          staged.geometry,
          now()
        FROM staged
        ON CONFLICT (facility_id) DO UPDATE SET
          name = EXCLUDED.name,
          full_address = EXCLUDED.full_address,
          municipality = EXCLUDED.municipality,
          agency = EXCLUDED.agency,
          agency_url = EXCLUDED.agency_url,
          owned_by = EXCLUDED.owned_by,
          maintained_by = EXCLUDED.maintained_by,
          operational_hours = EXCLUDED.operational_hours,
          contact_name = EXCLUDED.contact_name,
          contact_phone = EXCLUDED.contact_phone,
          contact_email = EXCLUDED.contact_email,
          earliest_burial_year = EXCLUDED.earliest_burial_year,
          image_url = EXCLUDED.image_url,
          notes = EXCLUDED.notes,
          geometry = EXCLUDED.geometry,
          updated_at = now()
      `,
      [batchId],
    );

    const sectionResult = await client.query(
      `
        WITH staged AS (
          SELECT
            section_feature.facility_id,
            section_feature.section_id,
            COALESCE(lower_properties.properties ->> 'name', section_feature.section_id) AS name,
            cemetery.id AS cemetery_id,
            ST_Multi(section_feature.geometry)::geometry(MultiPolygon, 4326) AS geometry
          FROM spatial_import_features section_feature
          CROSS JOIN LATERAL (
            SELECT jsonb_object_agg(lower(entry.key), entry.value) AS properties
            FROM jsonb_each(section_feature.source_properties) entry
          ) lower_properties
          JOIN cemeteries cemetery
            ON cemetery.facility_id IS NOT DISTINCT FROM section_feature.facility_id
          WHERE section_feature.batch_id = $1
            AND section_feature.feature_type = 'section'
        )
        INSERT INTO sections (
          cemetery_id,
          name,
          facility_id,
          section_id,
          geometry,
          updated_at
        )
        SELECT
          staged.cemetery_id,
          staged.name,
          staged.facility_id,
          staged.section_id,
          staged.geometry,
          now()
        FROM staged
        ON CONFLICT (facility_id, section_id) DO UPDATE SET
          cemetery_id = EXCLUDED.cemetery_id,
          name = EXCLUDED.name,
          geometry = EXCLUDED.geometry,
          updated_at = now()
      `,
      [batchId],
    );

    await client.query("COMMIT");
    console.log(`Promoted batch ${batchId}.`);
    console.log(`Cemeteries affected: ${cemeteryResult.rowCount}.`);
    console.log(`Sections affected: ${sectionResult.rowCount}.`);
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
