import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const component = fs.readFileSync(
  new URL("../src/components/detail/MediaRecords.tsx", import.meta.url),
  "utf8",
);
const styles = fs.readFileSync(new URL("../src/styles/detail.css", import.meta.url), "utf8");

test("media galleries show a maximum of four preview photos", () => {
  assert.match(component, /const galleryPreviewLimit = 4;/u);
  assert.match(component, /sortedAssets\.slice\(0, galleryPreviewLimit\)/u);
  assert.match(component, /View all photos \(\{sortedAssets\.length\}\)/u);
});

test("media galleries sort newest photos first and retain the complete history", () => {
  assert.match(component, /const dateDifference = .*rightDate.*leftDate/u);
  assert.match(component, /gallery\(sortedAssets, true\)/u);
  assert.match(component, /photos, newest first/u);
});

test("the complete photo history opens in an accessible modal", () => {
  assert.match(component, /role="dialog"/u);
  assert.match(component, /aria-modal="true"/u);
  assert.match(component, /event\.key === "Escape"/u);
  assert.match(styles, /\.media-gallery-modal-backdrop/u);
});
