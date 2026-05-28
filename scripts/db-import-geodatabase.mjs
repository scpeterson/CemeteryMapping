import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import pg from "pg";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const { Pool } = pg;

const sourceSrid = 3857;
const targetSrid = 4326;

const layerMappings = [
  {
    layerName: "Cemeteries",
    featureType: "cemetery",
    fields: {
      facility_id: "facilityid",
    },
  },
  {
    layerName: "Sections",
    featureType: "section",
    fields: {
      facility_id: "facilityid",
      section_id: "sectionid",
    },
  },
  {
    layerName: "Blocks",
    featureType: "block",
    fields: {
      facility_id: "facilityid",
      section_id: "sectionid",
      block_id: "blockid",
    },
  },
  {
    layerName: "Lots",
    featureType: "lot",
    fields: {
      facility_id: "facilityid",
      section_id: "sectionid",
      block_id: "blockid",
      lot_id: "lotid",
    },
  },
  {
    layerName: "Memorials",
    featureType: "memorial",
    fields: {},
  },
];

function usage() {
  console.error("Usage: npm run db:import:geodatabase -- /path/to/source.gdb [--source-name \"Source name\"] [--imported-by \"Name\"] [--notes \"Notes\"]");
}

function parseArgs(args) {
  const [geodatabasePath, ...rest] = args;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      usage();
      process.exit(1);
    }

    const key = arg.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for --${key}`);
      process.exit(1);
    }

    options[key] = value;
    index += 1;
  }

  return { geodatabasePath, options };
}

function propertyValue(properties, fieldName) {
  const entry = Object.entries(properties).find(([key]) => key.toLowerCase() === fieldName.toLowerCase());
  return entry?.[1] == null ? null : String(entry[1]);
}

function sourceFeatureId(feature) {
  const properties = feature.properties ?? {};
  return propertyValue(properties, "GlobalID") ?? propertyValue(properties, "globalid") ?? propertyValue(properties, "OBJECTID") ?? (feature.id == null ? null : String(feature.id));
}

function exportLayer(geodatabasePath, layerName, outputPath) {
  const result = spawnSync(
    "ogr2ogr",
    [
      "-f",
      "GeoJSON",
      "-s_srs",
      `EPSG:${sourceSrid}`,
      "-t_srs",
      `EPSG:${targetSrid}`,
      "-lco",
      "RFC7946=YES",
      outputPath,
      geodatabasePath,
      layerName,
    ],
    {
      encoding: "utf8",
    },
  );

  if (result.error) {
    throw new Error(`Unable to run ogr2ogr: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Unable to export ${layerName}: ${result.stderr || result.stdout}`);
  }
}

function readExportedFeatures(path) {
  const collection = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(collection.features) ? collection.features.filter((feature) => feature.geometry) : [];
}

async function main() {
  const { geodatabasePath, options } = parseArgs(process.argv.slice(2));
  if (!geodatabasePath) {
    usage();
    process.exit(1);
  }

  if (!existsSync(geodatabasePath) || !statSync(geodatabasePath).isDirectory()) {
    console.error(`File Geodatabase folder not found: ${geodatabasePath}`);
    process.exit(1);
  }

  const environment = currentEnvironment();
  const dbEnv = loadDbEnvironment(environment);
  const pool = new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? dbEnv.POSTGRES_PORT ?? 5432),
    database: process.env.PGDATABASE ?? dbEnv.POSTGRES_DB,
    user: process.env.PGUSER ?? dbEnv.POSTGRES_USER,
    password: process.env.PGPASSWORD ?? dbEnv.POSTGRES_PASSWORD,
  });

  const tempDirectory = mkdtempSync(join(tmpdir(), "cemetery-gdb-import-"));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const batchResult = await client.query(
      `
        INSERT INTO spatial_import_batches (source_name, source_format, source_srid, imported_by, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [options["source-name"] ?? basename(geodatabasePath), "FileGDB", sourceSrid, options["imported-by"] ?? null, options.notes ?? null],
    );
    const batchId = batchResult.rows[0].id;
    let importedCount = 0;

    for (const mapping of layerMappings) {
      const outputPath = join(tempDirectory, `${mapping.layerName}.geojson`);
      exportLayer(geodatabasePath, mapping.layerName, outputPath);
      const features = readExportedFeatures(outputPath);

      for (const feature of features) {
        const properties = feature.properties ?? {};
        await client.query(
          `
            INSERT INTO spatial_import_features (
              batch_id,
              feature_type,
              source_feature_id,
              facility_id,
              section_id,
              block_id,
              lot_id,
              grave_id,
              gravesite_id,
              source_properties,
              geometry
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10::jsonb,
              ST_SetSRID(ST_GeomFromGeoJSON($11), 4326)
            )
          `,
          [
            batchId,
            mapping.featureType,
            sourceFeatureId(feature),
            mapping.fields.facility_id ? propertyValue(properties, mapping.fields.facility_id) : null,
            mapping.fields.section_id ? propertyValue(properties, mapping.fields.section_id) : null,
            mapping.fields.block_id ? propertyValue(properties, mapping.fields.block_id) : null,
            mapping.fields.lot_id ? propertyValue(properties, mapping.fields.lot_id) : null,
            mapping.fields.grave_id ? propertyValue(properties, mapping.fields.grave_id) : null,
            mapping.fields.gravesite_id ? propertyValue(properties, mapping.fields.gravesite_id) : null,
            JSON.stringify(properties),
            JSON.stringify(feature.geometry),
          ],
        );
        importedCount += 1;
      }

      console.log(`${mapping.layerName}: imported ${features.length} feature${features.length === 1 ? "" : "s"}.`);
    }

    await client.query("COMMIT");
    console.log(`Created spatial import batch ${batchId} with ${importedCount} feature${importedCount === 1 ? "" : "s"}.`);
    console.log("Run npm run db:validate:spatial to review staging issues before promotion.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
