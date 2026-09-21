import assert from "node:assert/strict";
import test from "node:test";
import { createMapHighlightState, markerIdsByGrave, linkedMarkerIds } from "../src/components/mapHighlightState.ts";

test("highlight updates touch only changed IDs and independently clear selection and search", () => {
  const calls = [];
  const map = { getSource: () => ({}), setFeatureState: (target, state) => calls.push({ target, state }) };
  const sync = createMapHighlightState();
  sync(map, "graves", "selected", new Set(["A"]));
  sync(map, "graves", "selected", new Set(["A"]));
  assert.equal(calls.length, 1);
  sync(map, "graves", "searchMatch", new Set(["A", "B"]));
  sync(map, "graves", "selected", new Set(["B"]));
  assert.deepEqual(calls.slice(-2), [
    { target: { source: "graves", id: "A" }, state: { selected: false } },
    { target: { source: "graves", id: "B" }, state: { selected: true } },
  ]);
  sync(map, "graves", "searchMatch", new Set());
  assert.deepEqual(calls.slice(-2).map((call) => call.state), [{ searchMatch: false }, { searchMatch: false }]);
});

test("source-not-ready highlights retry and linked-marker lookup includes every marker", () => {
  let ready = false;
  const calls = [];
  const sync = createMapHighlightState();
  const map = { getSource: () => ready ? {} : undefined, setFeatureState: (...args) => calls.push(args) };
  sync(map, "lots", "selected", new Set(["lot"]));
  ready = true;
  sync(map, "lots", "selected", new Set(["lot"]));
  assert.equal(calls.length, 1);
  const index = markerIdsByGrave([{ id: "m1", graveKey: "g" }, { id: "m2", graveKey: "g" }, { id: "m3", graveKey: "other" }]);
  assert.deepEqual([...linkedMarkerIds(index, ["g", "missing"])], ["m1", "m2"]);
});
