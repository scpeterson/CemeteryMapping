import assert from "node:assert/strict";
import test from "node:test";
import { validateMarkerFaces, validateFacesRevision, validateFaceReferences } from "./markerFaces.mjs";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const face = (n = 1) => ({ id: id(n), label: "North", inscription: "  FIRST LINE\nSECOND LINE  ", notes: "Weathered", burialIds: [id(10)], mediaAssetIds: [id(20)] });
test("face validation preserves exact transcription and permits one person or photo on multiple faces", () => {
  const faces = [face(), { ...face(2), label: "Base" }];
  assert.deepEqual(validateMarkerFaces(faces), faces);
  assert.equal(validateMarkerFaces(undefined), undefined);
  assert.deepEqual(validateMarkerFaces([]), []);
  assert.equal(validateFacesRevision(0), 0);
});
test("invalid labels, duplicate IDs, unsafe associations and oversized face payloads are rejected", () => {
  for (const value of [null, {}, [null], [{ ...face(), label: " " }], [face(), { ...face(2), label: " north " }],
    [face(), { ...face(), label: "South" }], [{ ...face(), burialIds: ["not-a-uuid"] }],
    [{ ...face(), mediaAssetIds: [id(20), id(20)] }], [{ ...face(), inscription: 42 }],
    Array.from({ length: 33 }, (_, i) => ({ ...face(i+1), label: String(i) }))]) {
    assert.throws(() => validateMarkerFaces(value), { statusCode: 400 });
  }
  for (const value of [undefined, -1, "0", 0.1]) assert.throws(() => validateFacesRevision(value), { statusCode: 400 });
});
test("face associations accept only active records belonging to this marker", async () => {
  const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: values[1].map((id) => ({ id })) }; } };
  await validateFaceReferences(client, id(99), [face(), { ...face(2), label: "Back" }]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].values, [id(99), [id(10)]]);
  assert.deepEqual(calls[1].values, [id(99), [id(20)]]);
  await assert.rejects(validateFaceReferences({ query: async () => ({ rows: [] }) }, id(99), [face()]), /active burial records/);
  await assert.rejects(validateFaceReferences({ query: async () => ({ rows: [] }) }, id(99), [{ ...face(), burialIds: [] }]), /active photos/);
});
