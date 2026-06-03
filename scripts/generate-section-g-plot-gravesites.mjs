import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { currentEnvironment, loadDbEnvironment } from "./lib/run-liquibase.mjs";

const { Pool } = pg;

const feetToMeters = 0.3048;
const metersPerDegreeLatitude = 111320;

const sectionGStacks = [
  { firstPlot: 1, lastPlot: 23, x: -8, startY: 0 },
  { firstPlot: 24, lastPlot: 46, x: -16, startY: 0 },
  { firstPlot: 47, lastPlot: 65, x: -24, startY: 16 },
  { firstPlot: 66, lastPlot: 80, x: -32, startY: 32 },
  { firstPlot: 81, lastPlot: 90, x: -40, startY: 48 },
  { firstPlot: 91, lastPlot: 94, x: -48, startY: 64 },
];

function usage() {
  return [
    "Usage:",
    "  APP_ENV=dev node scripts/generate-section-g-plot-gravesites.mjs --output /tmp/section-g-gravesites.geojson",
    "",
    "Options:",
    "  --facility-id <id>       Cemetery facility id. Default: 1.",
    "  --section <name>         Section name. Default: G.",
    "  --output <path>          Output GeoJSON path. Default: /tmp/section-g-plot-gravesites.geojson.",
  ].join("\n");
}

function parseArgs(args) {
  const options = {
    facilityId: "1",
    section: "G",
    output: "/tmp/section-g-plot-gravesites.geojson",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--facility-id":
        options.facilityId = args[++index];
        break;
      case "--section":
        options.section = args[++index];
        break;
      case "--output":
        options.output = args[++index];
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }

  return options;
}

function localFeetToMeters(point) {
  return { x: point.x * feetToMeters, y: point.y * feetToMeters };
}

function exteriorRingFromGeoJson(geometry) {
  if (geometry.type === "Polygon") return geometry.coordinates[0];
  if (geometry.type === "MultiPolygon") return geometry.coordinates[0][0];
  throw new Error(`Unsupported section geometry type: ${geometry.type}`);
}

function sectionControlPoints(sectionGeometry) {
  const ring = exteriorRingFromGeoJson(sectionGeometry).slice(0, -1);
  if (ring.length < 4) throw new Error("Section G geometry must have at least four exterior vertices.");

  const sortedByLatitude = [...ring].sort((left, right) => left[1] - right[1]);
  const south = sortedByLatitude.slice(0, 2).sort((left, right) => left[0] - right[0]);
  const north = sortedByLatitude.slice(-2).sort((left, right) => left[0] - right[0]);

  return {
    A: south[0],
    G: south[1],
    B: north[0],
    C: north[1],
  };
}

function normalizeVector([x, y]) {
  const length = Math.hypot(x, y);
  if (length < 1e-9) throw new Error("Section G boundary does not provide enough orientation distance.");
  return [x / length, y / length];
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1];
}

function metersPerDegreeLongitude(latitude) {
  return metersPerDegreeLatitude * Math.cos(latitude * Math.PI / 180);
}

function lonLatToGroundMeters(point, origin) {
  const longitudeMeters = metersPerDegreeLongitude(origin[1]);
  return [
    (point[0] - origin[0]) * longitudeMeters,
    (point[1] - origin[1]) * metersPerDegreeLatitude,
  ];
}

function groundMetersToLonLat(point, origin) {
  const longitudeMeters = metersPerDegreeLongitude(origin[1]);
  return [
    origin[0] + point[0] / longitudeMeters,
    origin[1] + point[1] / metersPerDegreeLatitude,
  ];
}

function buildTrueScaleTransform(sectionGeometry) {
  const controls = sectionControlPoints(sectionGeometry);
  const origin = controls.A;
  const northAxis = normalizeVector(
    lonLatToGroundMeters(controls.B, origin),
  );
  const towardG = normalizeVector(
    lonLatToGroundMeters(controls.G, origin),
  );
  const perpendiculars = [
    [-northAxis[1], northAxis[0]],
    [northAxis[1], -northAxis[0]],
  ];
  const xAxis = perpendiculars.sort((left, right) => dot(towardG, right.map((value) => -value)) - dot(towardG, left.map((value) => -value)))[0];

  return (point) => groundMetersToLonLat([
    point.x * xAxis[0] + point.y * northAxis[0],
    point.x * xAxis[1] + point.y * northAxis[1],
  ], origin);
}

export function sectionGPlotRectangles() {
  return sectionGStacks.flatMap((stack) => {
    const plots = [];
    for (let plot = stack.firstPlot; plot <= stack.lastPlot; plot += 1) {
      const offset = plot - stack.firstPlot;
      const y = stack.startY + offset * 4;
      plots.push({
        plot,
        localRingFeet: [
          { x: stack.x, y },
          { x: stack.x + 8, y },
          { x: stack.x + 8, y: y + 4 },
          { x: stack.x, y: y + 4 },
          { x: stack.x, y },
        ],
      });
    }
    return plots;
  });
}

export function buildSectionGGravesiteFeatures(sectionGeometry) {
  const transform = buildTrueScaleTransform(sectionGeometry);

  return sectionGPlotRectangles().map((rectangle) => {
    const coordinates = rectangle.localRingFeet.map((point) => transform(localFeetToMeters(point)));
    const plotId = String(rectangle.plot).padStart(3, "0");
    return {
      type: "Feature",
      properties: {
        cemetery: "Trinity Lutheran Church Cemetery",
        section: "G",
        plot: rectangle.plot,
        grave_id: String(rectangle.plot),
        gravesite_id: `G-${plotId}`,
        source: "Section G Plot Plan With Notations.pdf",
        source_note: "Draft geometry generated from 4 ft by 4 ft plan grid; Section G plots are gravesites, not lots. Black X marks are surveyor aluminum spike references and are not gravesites.",
        dimensions_feet: "4 x 8",
        geometry_confidence: "draft",
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [[coordinates]],
      },
    };
  });
}

async function loadSectionGeometry(pool, { facilityId, section }) {
  const result = await pool.query(
    `
      SELECT ST_AsGeoJSON(sections.geometry)::json AS geometry
      FROM sections
      JOIN cemeteries ON cemeteries.id = sections.cemetery_id
      WHERE cemeteries.facility_id = $1
        AND sections.name = $2
        AND sections.deleted_at IS NULL
      LIMIT 1
    `,
    [facilityId, section],
  );
  if (!result.rows[0]) throw new Error(`Section ${section} not found for facility ${facilityId}.`);
  return result.rows[0].geometry;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(usage());
    return;
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

  try {
    const sectionGeometry = await loadSectionGeometry(pool, options);
    const features = buildSectionGGravesiteFeatures(sectionGeometry);
    const collection = {
      type: "FeatureCollection",
      name: "section_g_draft_gravesites",
      features,
    };
    writeFileSync(options.output, `${JSON.stringify(collection, null, 2)}\n`);
    console.log(`Generated ${features.length} draft Section G gravesite polygons.`);
    console.log(`Output: ${options.output}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
