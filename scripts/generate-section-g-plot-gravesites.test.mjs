import assert from "node:assert/strict";
import test from "node:test";
import { buildSectionGGravesiteFeatures, sectionGPlotRectangles } from "./generate-section-g-plot-gravesites.mjs";

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
