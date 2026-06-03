import assert from "node:assert/strict";
import test from "node:test";
import { buildSectionGGravesiteFeatures, sectionGPlotRectangles } from "./generate-section-g-plot-gravesites.mjs";

const feetToMeters = 0.3048;
const metersPerDegreeLatitude = 111320;

const sectionGGeometry = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [-80.0794283, 40.60163305],
        [-80.079694493, 40.601715033],
        [-80.079689847, 40.601338776],
        [-80.079607528, 40.601340808],
        [-80.0794283, 40.60163305],
      ],
    ],
  ],
};

function metersPerDegreeLongitude(latitude) {
  return metersPerDegreeLatitude * Math.cos(latitude * Math.PI / 180);
}

function groundDistance(left, right) {
  const averageLatitude = (left[1] + right[1]) / 2;
  return Math.hypot(
    (right[0] - left[0]) * metersPerDegreeLongitude(averageLatitude),
    (right[1] - left[1]) * metersPerDegreeLatitude,
  );
}

test("sectionGPlotRectangles models 94 plots without lots", () => {
  const plots = sectionGPlotRectangles();

  assert.equal(plots.length, 94);
  assert.deepEqual(plots.slice(0, 3).map((plot) => plot.plot), [1, 2, 3]);
  assert.deepEqual(plots.slice(-4).map((plot) => plot.plot), [91, 92, 93, 94]);
  assert.deepEqual(plots.find((plot) => plot.plot === 47)?.localRingFeet[0], { x: -24, y: 16 });
  assert.deepEqual(plots.find((plot) => plot.plot === 91)?.localRingFeet[0], { x: -48, y: 64 });
});

test("buildSectionGGravesiteFeatures creates draft gravesite GeoJSON from the section boundary", () => {
  const features = buildSectionGGravesiteFeatures(sectionGGeometry);

  assert.equal(features.length, 94);
  assert.equal(features[0].properties.gravesite_id, "G-001");
  assert.equal(features[0].properties.grave_id, "1");
  assert.equal(features[0].properties.section, "G");
  assert.equal(features[0].properties.geometry_confidence, "draft");
  assert.match(features[0].properties.source_note, /not lots/u);
  assert.equal(features[0].geometry.type, "MultiPolygon");
  assert.equal(features[0].geometry.coordinates[0][0].length, 5);
});

test("buildSectionGGravesiteFeatures preserves 4 by 8 foot plot dimensions", () => {
  const [firstFeature] = buildSectionGGravesiteFeatures(sectionGGeometry);
  const ring = firstFeature.geometry.coordinates[0][0];

  assert.equal(Math.round(groundDistance(ring[0], ring[1]) * 100), Math.round(8 * feetToMeters * 100));
  assert.equal(Math.round(groundDistance(ring[1], ring[2]) * 100), Math.round(4 * feetToMeters * 100));
});
