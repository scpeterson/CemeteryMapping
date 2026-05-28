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
            COALESCE(section_feature.section_id, lower_properties.properties ->> 'name') AS name,
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
          geometry,
          updated_at
        )
        SELECT
          staged.cemetery_id,
          staged.name,
          staged.facility_id,
          staged.geometry,
          now()
        FROM staged
        WHERE staged.name IS NOT NULL
        ON CONFLICT (cemetery_id, name) DO UPDATE SET
          cemetery_id = EXCLUDED.cemetery_id,
          facility_id = EXCLUDED.facility_id,
          geometry = EXCLUDED.geometry,
          updated_at = now()
      `,
      [batchId],
    );

    const blockResult = await client.query(
      `
        WITH staged AS (
          SELECT
            block_feature.facility_id,
            block_feature.section_id,
            block_feature.block_id,
            COALESCE(lower_properties.properties ->> 'name', block_feature.block_id) AS name,
            cemetery.id AS cemetery_id,
            section.section_id AS section_uuid,
            ST_Multi(block_feature.geometry)::geometry(MultiPolygon, 4326) AS geometry
          FROM spatial_import_features block_feature
          CROSS JOIN LATERAL (
            SELECT jsonb_object_agg(lower(entry.key), entry.value) AS properties
            FROM jsonb_each(block_feature.source_properties) entry
          ) lower_properties
          JOIN cemeteries cemetery
            ON cemetery.facility_id IS NOT DISTINCT FROM block_feature.facility_id
          LEFT JOIN sections section
            ON section.cemetery_id = cemetery.id
           AND section.name IS NOT DISTINCT FROM block_feature.section_id
          WHERE block_feature.batch_id = $1
            AND block_feature.feature_type = 'block'
            AND block_feature.block_id IS NOT NULL
        )
        INSERT INTO blocks (
          cemetery_id,
          section_uuid,
          name,
          facility_id,
          section_id,
          block_id,
          geometry,
          updated_at
        )
        SELECT
          staged.cemetery_id,
          staged.section_uuid,
          staged.name,
          staged.facility_id,
          staged.section_id,
          staged.block_id,
          staged.geometry,
          now()
        FROM staged
        ON CONFLICT (facility_id, section_id, block_id) DO UPDATE SET
          cemetery_id = EXCLUDED.cemetery_id,
          section_uuid = EXCLUDED.section_uuid,
          name = EXCLUDED.name,
          geometry = EXCLUDED.geometry,
          updated_at = now()
      `,
      [batchId],
    );

    const lotWithBlockResult = await client.query(
      `
        WITH staged AS (
          SELECT
            lot_feature.facility_id,
            lot_feature.section_id,
            lot_feature.block_id,
            lot_feature.lot_id,
            COALESCE(lower_properties.properties ->> 'name', lot_feature.lot_id) AS name,
            cemetery.id AS cemetery_id,
            section.section_id AS section_uuid,
            block.id AS block_uuid,
            ST_Multi(lot_feature.geometry)::geometry(MultiPolygon, 4326) AS geometry
          FROM spatial_import_features lot_feature
          CROSS JOIN LATERAL (
            SELECT jsonb_object_agg(lower(entry.key), entry.value) AS properties
            FROM jsonb_each(lot_feature.source_properties) entry
          ) lower_properties
          JOIN cemeteries cemetery
            ON cemetery.facility_id IS NOT DISTINCT FROM lot_feature.facility_id
          LEFT JOIN sections section
            ON section.cemetery_id = cemetery.id
           AND section.name IS NOT DISTINCT FROM lot_feature.section_id
          LEFT JOIN blocks block
            ON block.cemetery_id = cemetery.id
           AND block.section_id IS NOT DISTINCT FROM lot_feature.section_id
           AND block.block_id IS NOT DISTINCT FROM lot_feature.block_id
          WHERE lot_feature.batch_id = $1
            AND lot_feature.feature_type = 'lot'
            AND lot_feature.block_id IS NOT NULL
            AND lot_feature.lot_id IS NOT NULL
        )
        INSERT INTO lots (
          cemetery_id,
          section_uuid,
          block_uuid,
          name,
          facility_id,
          section_id,
          block_id,
          lot_id,
          geometry,
          updated_at
        )
        SELECT
          staged.cemetery_id,
          staged.section_uuid,
          staged.block_uuid,
          staged.name,
          staged.facility_id,
          staged.section_id,
          staged.block_id,
          staged.lot_id,
          staged.geometry,
          now()
        FROM staged
        ON CONFLICT ON CONSTRAINT lots_identifier_unique DO UPDATE SET
          cemetery_id = EXCLUDED.cemetery_id,
          section_uuid = EXCLUDED.section_uuid,
          block_uuid = EXCLUDED.block_uuid,
          name = EXCLUDED.name,
          geometry = EXCLUDED.geometry,
          updated_at = now()
      `,
      [batchId],
    );

    const sectionScopedLotResult = await client.query(
      `
        WITH staged AS (
          SELECT
            lot_feature.facility_id,
            lot_feature.section_id,
            lot_feature.lot_id,
            COALESCE(lower_properties.properties ->> 'name', lot_feature.lot_id) AS name,
            cemetery.id AS cemetery_id,
            section.section_id AS section_uuid,
            ST_Multi(lot_feature.geometry)::geometry(MultiPolygon, 4326) AS geometry
          FROM spatial_import_features lot_feature
          CROSS JOIN LATERAL (
            SELECT jsonb_object_agg(lower(entry.key), entry.value) AS properties
            FROM jsonb_each(lot_feature.source_properties) entry
          ) lower_properties
          JOIN cemeteries cemetery
            ON cemetery.facility_id IS NOT DISTINCT FROM lot_feature.facility_id
          LEFT JOIN sections section
            ON section.cemetery_id = cemetery.id
           AND section.name IS NOT DISTINCT FROM lot_feature.section_id
          WHERE lot_feature.batch_id = $1
            AND lot_feature.feature_type = 'lot'
            AND lot_feature.block_id IS NULL
            AND lot_feature.lot_id IS NOT NULL
        )
        INSERT INTO lots (
          cemetery_id,
          section_uuid,
          name,
          facility_id,
          section_id,
          block_id,
          lot_id,
          geometry,
          updated_at
        )
        SELECT
          staged.cemetery_id,
          staged.section_uuid,
          staged.name,
          staged.facility_id,
          staged.section_id,
          NULL,
          staged.lot_id,
          staged.geometry,
          now()
        FROM staged
        ON CONFLICT (facility_id, section_id, lot_id) WHERE block_id IS NULL DO UPDATE SET
          cemetery_id = EXCLUDED.cemetery_id,
          section_uuid = EXCLUDED.section_uuid,
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
    console.log(`Blocks affected: ${blockResult.rowCount}.`);
    console.log(`Lots affected: ${lotWithBlockResult.rowCount + sectionScopedLotResult.rowCount}.`);
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
