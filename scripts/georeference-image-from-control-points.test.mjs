import assert from "node:assert/strict";
import test from "node:test";
import { buildGdalCommands, formatCommand, loadControlPoints, parseArgs } from "./georeference-image-from-control-points.mjs";

const sampleJson = JSON.stringify({
  points: [
    {
      sourceImageName: "TIFF2042-01.tif",
      x: 100,
      y: 200,
      longitude: -80.1,
      latitude: 40.1,
      confidence: "high",
      description: "one",
    },
    {
      sourceImageName: "TIFF2042-01.tif",
      x: 300,
      y: 400,
      longitude: -80.2,
      latitude: 40.2,
      confidence: "medium",
      description: "two",
    },
    {
      sourceImageName: "TIFF2042-01.tif",
      x: 500,
      y: 600,
      longitude: -80.3,
      latitude: 40.3,
      confidence: "low",
      description: "three",
    },
    {
      sourceImageName: "TIFF2043-01.tif",
      x: 700,
      y: 800,
      longitude: -80.4,
      latitude: 40.4,
      confidence: "high",
      description: "four",
    },
  ],
});

test("loadControlPoints filters by source image and confidence", () => {
  const points = loadControlPoints(sampleJson, { sourceName: "TIFF2042-01.tif", minConfidence: "medium" });

  assert.equal(points.length, 2);
  assert.deepEqual(
    points.map((point) => point.description),
    ["one", "two"],
  );
});

test("buildGdalCommands creates translate and warp commands", () => {
  const points = loadControlPoints(sampleJson, { sourceName: "TIFF2042-01.tif" });
  const options = parseArgs([
    "--control-points",
    "points.json",
    "--image",
    "source map.png",
    "--output",
    "registered.tif",
    "--source-name",
    "TIFF2042-01.tif",
  ]);

  const [translate, warp] = buildGdalCommands(options, points);

  assert.equal(translate.command, "gdal_translate");
  assert.deepEqual(translate.args.slice(0, 4), ["-of", "GTiff", "-a_srs", "EPSG:4326"]);
  assert.equal(translate.args.filter((arg) => arg === "-gcp").length, 3);
  assert.deepEqual(translate.args.slice(-2), ["source map.png", "registered.gcps.tif"]);

  assert.equal(warp.command, "gdalwarp");
  assert.deepEqual(warp.args, ["-t_srs", "EPSG:3857", "-r", "near", "-order", "1", "registered.gcps.tif", "registered.tif"]);
  assert.match(formatCommand(translate), /'source map\.png'/u);
});

test("buildGdalCommands rejects insufficient points for higher order transforms", () => {
  const points = loadControlPoints(sampleJson, { sourceName: "TIFF2042-01.tif" });
  assert.throws(
    () =>
      buildGdalCommands(
        {
          image: "source.png",
          output: "registered.tif",
          sourceSrs: "EPSG:4326",
          targetSrs: "EPSG:3857",
          transform: "order2",
          resampling: "near",
        },
        points,
      ),
    /requires at least 6 control points/u,
  );
});
