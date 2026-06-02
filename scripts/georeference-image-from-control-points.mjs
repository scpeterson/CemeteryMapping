import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const confidenceOrder = new Map([
  ["low", 0],
  ["medium", 1],
  ["high", 2],
]);

function usage() {
  return [
    "Usage:",
    "  npm run georef:image -- --control-points <points.json> --image <source.png> --output <georeferenced.tif> --source-name <TIFF2042-01.tif>",
    "",
    "Options:",
    "  --control-points <path>   JSON exported from the Control Point Collector.",
    "  --image <path>            PNG/JPEG/TIFF image file to georeference.",
    "  --output <path>           Output GeoTIFF path.",
    "  --source-name <name>      Filter points to one source image name from the JSON.",
    "  --intermediate <path>     Optional intermediate TIFF with embedded GCPs.",
    "  --source-srs <srs>        Coordinate system for GCP longitude/latitude. Default: EPSG:4326.",
    "  --target-srs <srs>        Output coordinate system. Default: EPSG:3857.",
    "  --transform <mode>        affine, tps, order2, or order3. Default: affine.",
    "  --resampling <method>     GDAL resampling method. Default: near.",
    "  --min-confidence <level>  low, medium, or high. Default: low.",
    "  --run                     Execute GDAL. Without --run, commands are printed only.",
  ].join("\n");
}

function requireOption(options, key) {
  const value = options[key];
  if (!value) throw new Error(`${key} is required.\n\n${usage()}`);
  return value;
}

export function parseArgs(args) {
  const options = {
    sourceSrs: "EPSG:4326",
    targetSrs: "EPSG:3857",
    transform: "affine",
    resampling: "near",
    minConfidence: "low",
    run: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--control-points":
        options.controlPoints = args[++index];
        break;
      case "--image":
        options.image = args[++index];
        break;
      case "--output":
        options.output = args[++index];
        break;
      case "--source-name":
        options.sourceName = args[++index];
        break;
      case "--intermediate":
        options.intermediate = args[++index];
        break;
      case "--source-srs":
        options.sourceSrs = args[++index];
        break;
      case "--target-srs":
        options.targetSrs = args[++index];
        break;
      case "--transform":
        options.transform = args[++index];
        break;
      case "--resampling":
        options.resampling = args[++index];
        break;
      case "--min-confidence":
        options.minConfidence = args[++index];
        break;
      case "--run":
        options.run = true;
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

function normalizedConfidence(value) {
  const confidence = String(value ?? "low").toLowerCase();
  return confidenceOrder.has(confidence) ? confidence : "low";
}

export function loadControlPoints(jsonText, { sourceName, minConfidence = "low" } = {}) {
  const parsed = JSON.parse(jsonText);
  const rawPoints = Array.isArray(parsed) ? parsed : parsed.points;
  if (!Array.isArray(rawPoints)) throw new Error("Control point JSON must contain a points array.");

  const minimum = confidenceOrder.get(normalizedConfidence(minConfidence)) ?? 0;
  return rawPoints
    .filter((point) => !sourceName || point.sourceImageName === sourceName)
    .filter((point) => (confidenceOrder.get(normalizedConfidence(point.confidence)) ?? 0) >= minimum)
    .map((point, index) => {
      const normalized = {
        sourceImageName: String(point.sourceImageName ?? ""),
        x: Number(point.x),
        y: Number(point.y),
        longitude: Number(point.longitude),
        latitude: Number(point.latitude),
        confidence: normalizedConfidence(point.confidence),
        description: String(point.description ?? ""),
      };
      if (![normalized.x, normalized.y, normalized.longitude, normalized.latitude].every(Number.isFinite)) {
        throw new Error(`Control point ${index + 1} has invalid image or map coordinates.`);
      }
      return normalized;
    });
}

function requiredPointCount(transform) {
  if (transform === "order2") return 6;
  if (transform === "order3") return 10;
  return 3;
}

export function validateOptions(options) {
  if (options.help) return;
  requireOption(options, "controlPoints");
  requireOption(options, "image");
  requireOption(options, "output");
  if (!["affine", "tps", "order2", "order3"].includes(options.transform)) {
    throw new Error("--transform must be affine, tps, order2, or order3.");
  }
  if (!confidenceOrder.has(normalizedConfidence(options.minConfidence))) {
    throw new Error("--min-confidence must be low, medium, or high.");
  }
}

function defaultIntermediatePath(outputPath) {
  const parsed = path.parse(outputPath);
  return path.join(parsed.dir, `${parsed.name}.gcps.tif`);
}

export function buildGdalCommands(options, points) {
  const minimum = requiredPointCount(options.transform);
  if (points.length < minimum) {
    throw new Error(`${options.transform} georeferencing requires at least ${minimum} control points; found ${points.length}.`);
  }

  const intermediate = options.intermediate ?? defaultIntermediatePath(options.output);
  const translateArgs = ["-of", "GTiff", "-a_srs", options.sourceSrs];
  points.forEach((point) => {
    translateArgs.push("-gcp", String(point.x), String(point.y), String(point.longitude), String(point.latitude));
  });
  translateArgs.push(options.image, intermediate);

  const warpArgs = ["-t_srs", options.targetSrs, "-r", options.resampling];
  if (options.transform === "tps") warpArgs.push("-tps");
  else if (options.transform === "order2") warpArgs.push("-order", "2");
  else if (options.transform === "order3") warpArgs.push("-order", "3");
  else warpArgs.push("-order", "1");
  warpArgs.push(intermediate, options.output);

  return [
    { command: "gdal_translate", args: translateArgs },
    { command: "gdalwarp", args: warpArgs },
  ];
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=+-]+$/u.test(value)) return value;
  return `'${value.replace(/'/gu, "'\\''")}'`;
}

export function formatCommand(command) {
  return [command.command, ...command.args].map(shellQuote).join(" ");
}

function runCommand(command) {
  const result = spawnSync(command.command, command.args, { stdio: "inherit" });
  if (result.error) {
    throw new Error(`Unable to run ${command.command}: ${result.error.message}. Install GDAL and make sure ${command.command} is on your PATH.`);
  }
  if (result.status !== 0) throw new Error(`${command.command} exited with status ${result.status}.`);
}

export function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(usage());
    return;
  }
  validateOptions(options);

  const points = loadControlPoints(readFileSync(options.controlPoints, "utf8"), {
    sourceName: options.sourceName,
    minConfidence: options.minConfidence,
  });
  const commands = buildGdalCommands(options, points);

  console.log(`Using ${points.length} control points${options.sourceName ? ` for ${options.sourceName}` : ""}.`);
  commands.forEach((command) => console.log(formatCommand(command)));

  if (options.run) commands.forEach(runCommand);
  else console.log("\nReview the commands, then rerun with --run to create the georeferenced GeoTIFF.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
