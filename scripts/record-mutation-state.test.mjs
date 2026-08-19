import assert from "node:assert/strict";
import test from "node:test";
import {
  appendHeadstoneSummary,
  assignLotInMapData,
  assignLotToSelectedGrave,
  moveMediaAssetInRecord,
  removeFeatureFromGrave,
  removeFeatureFromHeadstone,
  removeMediaAsset,
  replaceBurialInGrave,
  replaceHeadstoneInGrave,
  replaceHeadstoneSummary,
} from "../src/hooks/recordMutationState.ts";

const graveSummary = (id, lot = "old-lot") => ({ id, cemeteryId: "cemetery-1", section: "C", lot, grave: id, name: id, status: "available", geometry: { type: "Polygon", coordinates: [] } });
const markerSummary = (id, markerType = "Old type") => ({ id, headstoneId: id, cemeteryId: "cemetery-1", label: id, markerTypeCode: "old", markerType, markerScopeCode: "single", markerScope: "Single", condition: "unknown", geometry: { type: "Point", coordinates: [0, 0] } });
const savedMarker = (id) => ({ id, headstoneId: id, markerType: { id: "type-1", code: "tablet", label: "Tablet" }, markerScope: { id: "scope-1", code: "couple", label: "Couple" }, condition: { id: "condition-1", code: "good", label: "Good" } });

test("a marker save replaces only the matching detail and map summary", () => {
  const oldMarker = savedMarker("marker-1");
  oldMarker.markerType = { id: "old", code: "old", label: "Old type" };
  const otherMarker = savedMarker("marker-2");
  const grave = { id: "grave-1", headstones: [oldMarker, otherMarker], burials: [] };
  const saved = savedMarker("marker-1");
  const data = { graves: [graveSummary("grave-1")], headstones: [markerSummary("marker-1"), markerSummary("marker-2", "Other")] };

  const nextGrave = replaceHeadstoneInGrave(grave, saved);
  const nextData = replaceHeadstoneSummary(data, saved);

  assert.equal(nextGrave.headstones[0], saved);
  assert.equal(nextGrave.headstones[1], otherMarker);
  assert.deepEqual(nextData.headstones[0], { ...data.headstones[0], markerTypeCode: "tablet", markerType: "Tablet", markerScopeCode: "couple", markerScope: "Couple", condition: "good" });
  assert.equal(nextData.headstones[1], data.headstones[1]);
  assert.equal(nextData.graves, data.graves, "unrelated map collections stay intact");
});

test("marker creation appends once and replaces an existing summary on replay", () => {
  const existing = markerSummary("marker-1");
  const created = markerSummary("marker-2", "Tablet");
  const data = { graves: [], headstones: [existing] };
  const appended = appendHeadstoneSummary(data, created);
  const replayed = appendHeadstoneSummary(appended, { ...created, condition: "good" });

  assert.deepEqual(appended.headstones.map(({ id }) => id), ["marker-1", "marker-2"]);
  assert.equal(replayed.headstones.length, 2);
  assert.equal(replayed.headstones[1].condition, "good");
  assert.equal(replayed.headstones[0], existing);
});

test("a burial save changes only the matching burial", () => {
  const first = { id: "burial-1", person: { firstName: "Old", lastName: "Name" } };
  const second = { id: "burial-2", person: { firstName: "Other", lastName: "Name" } };
  const saved = { ...first, person: { firstName: "Updated", lastName: "Name" } };
  const grave = { id: "grave-1", headstones: [], burials: [first, second] };

  const next = replaceBurialInGrave(grave, saved);
  assert.equal(next.burials[0], saved);
  assert.equal(next.burials[1], second);
  assert.equal(next.headstones, grave.headstones);
});

test("lot assignment updates the matching map and selected summaries without touching others", () => {
  const selected = graveSummary("grave-1");
  const other = graveSummary("grave-2");
  const data = { graves: [selected, other], headstones: [] };
  const nextData = assignLotInMapData(data, selected, "new-lot");
  const nextSelected = assignLotToSelectedGrave(selected, selected, "new-lot");

  assert.equal(nextData.graves[0].lot, "new-lot");
  assert.equal(nextData.graves[1], other);
  assert.equal(nextSelected.lot, "new-lot");
  assert.equal(assignLotToSelectedGrave(other, selected, "new-lot"), other);
  assert.equal(nextData.headstones, data.headstones);
});

test("state helpers preserve absent detail state", () => {
  assert.equal(replaceHeadstoneInGrave(undefined, savedMarker("marker-1")), undefined);
  assert.equal(replaceBurialInGrave(undefined, { id: "burial-1" }), undefined);
});

test("feature deletion removes the feature from grave and nested marker caches", () => {
  const removed = { id: "feature-1" };
  const retained = { id: "feature-2" };
  const grave = { features: [removed, retained], headstones: [{ id: "marker-1", features: [removed, retained] }], burials: [] };
  const headstone = grave.headstones[0];

  const nextGrave = removeFeatureFromGrave(grave, removed.id);
  const nextHeadstone = removeFeatureFromHeadstone(headstone, removed.id);
  assert.deepEqual(nextGrave.features, [retained]);
  assert.deepEqual(nextGrave.headstones[0].features, [retained]);
  assert.deepEqual(nextHeadstone.features, [retained]);
});

test("photo deletion and movement update only local media collections", () => {
  const first = { id: "photo-1" };
  const second = { id: "photo-2" };
  const third = { id: "photo-3" };
  const record = { id: "grave-1", mediaAssets: [first, second, third], headstones: [] };

  const moved = moveMediaAssetInRecord(record, second.id, "earlier");
  assert.deepEqual(moved.mediaAssets, [second, first, third]);
  assert.equal(moved.headstones, record.headstones);
  assert.equal(moveMediaAssetInRecord(record, first.id, "earlier"), record, "an unavailable adjacent position is a no-op");
  assert.deepEqual(removeMediaAsset(record, second.id).mediaAssets, [first, third]);
});
