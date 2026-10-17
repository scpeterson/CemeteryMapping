import assert from "node:assert/strict";
import test from "node:test";
import { updateEvidenceInGrave, updateEvidenceInMarker } from "../src/hooks/evidenceMutationState.ts";

for (const [kind, collection] of [["feature", "features"], ["maintenance", "maintenanceRecords"]]) {
  test(`${kind} updates stay on their target and preserve unrelated collections`, () => {
    const other = { id: "other", features: [], maintenanceRecords: [] };
    const target = { id: "target", features: [], maintenanceRecords: [] };
    const grave = { id: "grave", features: [], maintenanceRecords: [], headstones: [target, other] };
    const saved = { id: "new", headstoneUuid: "target" };
    const added = updateEvidenceInGrave(grave, { kind, saved }, true, false);
    assert.deepEqual(added[collection], []);
    assert.deepEqual(added.headstones[0][collection], [saved]);
    assert.equal(added.headstones[1], other);
    assert.deepEqual(target[collection], []);
    assert.equal(updateEvidenceInMarker(other, { kind, saved }, true), other);
    const changed = { ...saved, notes: "updated" };
    const updated = updateEvidenceInGrave(added, { kind, saved: changed });
    assert.deepEqual(updated.headstones[0][collection], [changed]);
    assert.deepEqual(updated[collection], []);
    assert.equal(updateEvidenceInGrave(undefined, { kind, saved }), undefined);
  });
}
