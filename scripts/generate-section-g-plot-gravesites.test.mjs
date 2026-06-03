import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSectionGBoundaryFeature,
  buildSectionGGravesiteFeatures,
  sectionGBoundaryRingFeet,
  sectionGPlotRectangles,
} from "./generate-section-g-plot-gravesites.mjs";

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

const sectionB0089Geometry = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [-80.07975417, 40.60135903],
        [-80.079718159, 40.60135903],
        [-80.079718159, 40.60137001],
        [-80.07975417, 40.60137001],
        [-80.07975417, 40.60135903],
      ],
    ],
  ],
};

function metersPerDegreeLongitude(latitude) {
  return metersPerDegreeLatitude * Math.cos(latitude * Math.PI / 180);
}

function exteriorPoints(geometry) {
  return geometry.coordinates[0][0].slice(0, -1);
}

function southEdgeMidpoint(geometry) {
  const sortedByLatitude = exteriorPoints(geometry).sort((left, right) => left[1] - right[1]);
  const southEdge = sortedByLatitude.slice(0, 2);
  return [
    (southEdge[0][0] + southEdge[1][0]) / 2,
    (southEdge[0][1] + southEdge[1][1]) / 2,
  ];
}

function groundVector(from, to) {
  return [
    (to[0] - from[0]) * metersPerDegreeLongitude(from[1]),
    (to[1] - from[1]) * metersPerDegreeLatitude,
  ];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1]);
  return [vector[0] / length, vector[1] / length];
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1];
}

function signedNorthing(point) {
  const sectionPoints = exteriorPoints(sectionGGeometry);
  const sortedByLatitude = [...sectionPoints].sort((left, right) => left[1] - right[1]);
  const southWest = sortedByLatitude.slice(0, 2).sort((left, right) => left[0] - right[0])[0];
  const northWest = sortedByLatitude.slice(-2).sort((left, right) => left[0] - right[0])[0];
  const northAxis = normalize(groundVector(southWest, northWest));
  return dot(groundVector(southWest, point), northAxis);
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

test("sectionGBoundaryRingFeet creates the simplified angled outline around Section G plots", () => {
  const boundary = sectionGBoundaryRingFeet();
  const boundaryXs = boundary.map((point) => point.x);
  const boundaryYs = boundary.map((point) => point.y);

  assert.equal(boundary.length, 8);
  assert.deepEqual(boundary[0], boundary.at(-1));
  assert.equal(Math.min(...boundaryXs), -48);
  assert.equal(Math.max(...boundaryXs), 0);
  assert.equal(Math.min(...boundaryYs), 0);
  assert.equal(Math.max(...boundaryYs), 92);
  assert.deepEqual(boundary.slice(0, -1), [
    { x: 0, y: 0 },
    { x: 0, y: 92 },
    { x: -32, y: 92 },
    { x: -40, y: 88 },
    { x: -48, y: 80 },
    { x: -48, y: 64 },
    { x: -16, y: 0 },
  ]);
});

test("buildSectionGGravesiteFeatures aligns the south baseline to the B-0089 south edge", () => {
  const features = buildSectionGGravesiteFeatures(sectionGGeometry, sectionB0089Geometry);
  const plot1SouthMidpoint = southEdgeMidpoint(features[0].geometry);
  const plot24SouthMidpoint = southEdgeMidpoint(features[23].geometry);
  const referenceSouthMidpoint = southEdgeMidpoint(sectionB0089Geometry);

  assert.equal(Math.round(signedNorthing(plot1SouthMidpoint) * 100), Math.round(signedNorthing(referenceSouthMidpoint) * 100));
  assert.equal(Math.round(signedNorthing(plot24SouthMidpoint) * 100), Math.round(signedNorthing(referenceSouthMidpoint) * 100));
});

test("buildSectionGBoundaryFeature generates a tight Section G boundary feature", () => {
  const boundaryFeature = buildSectionGBoundaryFeature(sectionGGeometry, sectionB0089Geometry);
  const boundaryRing = boundaryFeature.geometry.coordinates[0][0];

  assert.equal(boundaryFeature.properties.section, "G");
  assert.equal(boundaryFeature.geometry.type, "MultiPolygon");
  assert.equal(boundaryRing.length, sectionGBoundaryRingFeet().length);
  assert.deepEqual(boundaryRing[0], boundaryRing.at(-1));
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
