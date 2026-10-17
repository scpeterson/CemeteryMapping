import assert from "node:assert/strict";
import test from "node:test";
import { primaryPhotoUpdater } from "../src/hooks/primaryPhotoUpdates.ts";

test("photo updates are link-specific, preserve unrelated photos, and use the last update", () => {
  const unchanged = { id: "same-asset", mediaLinkId: "other", isPrimary: true };
  const unlinked = { id: "legacy", isPrimary: false };
  const input = [{ id: "same-asset", mediaLinkId: "target", isPrimary: true }, unchanged, unlinked];
  const apply = primaryPhotoUpdater([{ id: "target", is_primary: true }, { id: "target", is_primary: false }]);
  const output = apply(input);
  assert.equal(output[0].isPrimary, false);
  assert.equal(input[0].isPrimary, true);
  assert.equal(output[1], unchanged);
  assert.equal(output[2], unlinked);
  assert.equal(apply(output)[0], output[0]);
});
