import assert from "node:assert/strict";
import test from "node:test";
import { toMediaAsset } from "./cemeteryMappers.mjs";

test("gravesite photos retain their primary selection and editable link identity", () => {
  const photo = toMediaAsset({ id: "photo", media_link_id: "link", media_link_type: "gravesite", is_primary: true, display_order: 2 });
  assert.equal(photo.isPrimary, true);
  assert.equal(photo.mediaLinkId, "link");
  assert.equal(photo.mediaLinkType, "gravesite");
  assert.equal(photo.displayOrder, 2);
  assert.equal(toMediaAsset({ id: "unselected" }).isPrimary, false);
});
