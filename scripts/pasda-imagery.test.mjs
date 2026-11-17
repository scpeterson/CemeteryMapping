import test from "node:test";
import assert from "node:assert/strict";
import { addPasdaImagery, updatePasdaImagery } from "../src/components/pasdaImagery.ts";

function fixture(width = 393, height = 600) {
  const canvas = { clientWidth: width, clientHeight: height };
  const sources = new Map(), listeners = new Map(), requests = [];
  let visibility = "visible", west = -80.081;
  const map = {
    getBounds: () => ({ getWest: () => west, getEast: () => -80.079, getSouth: () => 40.6, getNorth: () => 40.603 }),
    getCanvas: () => canvas,
    addSource: (id, options) => sources.set(id, { ...options, updateImage: image => requests.push(image) }),
    addLayer: () => {},
    getLayoutProperty: () => visibility,
    getSource: id => sources.get(id),
    on: (event, callback) => listeners.set(event, callback),
    once: (event, callback) => listeners.set(event, callback),
  };
  addPasdaImagery(map);
  return {
    map, canvas, requests, sources,
    emit: (event, data) => listeners.get(event)?.(data),
    setVisibility: value => { visibility = value; },
    pan: () => { west -= .001; },
  };
}
const size = image => new URL(image.url).searchParams.get("size");

test("hidden initialization and resize do not request imagery; revealing loads the final viewport once", () => {
  const f = fixture(0, 0);
  assert.equal(f.sources.get("pasda-imagery-2017").url, undefined);
  for (const event of ["idle", "resize", "moveend"]) f.emit(event);
  updatePasdaImagery(f.map, true);
  assert.equal(f.requests.length, 0);
  Object.assign(f.canvas, { clientWidth: 393, clientHeight: 600 });
  f.emit("resize"); f.emit("moveend");
  assert.equal(f.requests.length, 1);
  assert.equal(size(f.requests[0]), "393,600");
  assert.deepEqual(f.requests[0].coordinates[0], [-80.081, 40.603]);
});

test("duplicate events reuse the current request but changed size or bounds request new imagery", () => {
  const f = fixture();
  f.emit("idle"); f.emit("resize"); f.emit("moveend");
  assert.equal(f.requests.length, 1);
  f.canvas.clientWidth = 390;
  f.emit("resize"); f.emit("moveend");
  assert.equal(f.requests.length, 2);
  assert.equal(size(f.requests[1]), "390,600");
  f.pan(); f.emit("moveend");
  assert.equal(f.requests.length, 3);
  assert.notEqual(f.requests[1].url, f.requests[2].url);
});

test("hiding an existing map retains its last request and defers changed bounds until visible", () => {
  const f = fixture(); f.emit("idle");
  f.canvas.clientWidth = 0; f.pan();
  f.emit("resize"); f.emit("moveend");
  assert.equal(f.requests.length, 1);
  f.canvas.clientWidth = 393;
  f.emit("resize"); f.emit("moveend");
  assert.equal(f.requests.length, 2);
  f.canvas.clientHeight = 0; f.emit("resize");
  assert.equal(f.requests.length, 2);
});

test("Diagram view skips imagery and Geographic view can load it after becoming visible", () => {
  const f = fixture(); f.setVisibility("none");
  f.emit("idle"); f.emit("resize"); updatePasdaImagery(f.map, true);
  assert.equal(f.requests.length, 0);
  f.setVisibility("visible"); updatePasdaImagery(f.map);
  assert.equal(f.requests.length, 1);
});

test("explicit retry and recovery after failure work for identical bounds without affecting another map", () => {
  const f = fixture(), other = fixture(); f.emit("idle"); other.emit("idle");
  f.emit("error", { sourceId: "allegheny-parcels" }); f.emit("resize");
  assert.equal(f.requests.length, 1);
  f.emit("error", { sourceId: "pasda-imagery-2017" });
  f.emit("resize"); f.emit("moveend");
  assert.equal(f.requests.length, 2);
  updatePasdaImagery(f.map, true);
  assert.equal(f.requests.length, 3);
  assert.equal(new Set(f.requests.map(image => image.url)).size, 1);
  other.emit("resize"); assert.equal(other.requests.length, 1);
});
