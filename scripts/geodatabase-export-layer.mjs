import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

const [geodatabasePath, layerName, outputPath] = process.argv.slice(2);
const sourceSrid = 3857;
const targetSrid = 4326;

if (!geodatabasePath || !layerName || !outputPath) {
  console.error("Usage: npm run geodatabase:export -- /path/to/source.gdb LayerName /path/to/output.geojson");
  process.exit(1);
}

if (!existsSync(geodatabasePath) || !statSync(geodatabasePath).isDirectory()) {
  console.error(`File Geodatabase folder not found: ${geodatabasePath}`);
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });

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
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Unable to run ogr2ogr: ${result.error.message}`);
  console.error("Install GDAL/OGR and make sure ogr2ogr is on your PATH.");
  process.exit(1);
}

process.exit(result.status ?? 1);
