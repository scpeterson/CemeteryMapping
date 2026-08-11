import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../db/changelog/changes/310-add-eckendahl-field-photo-marker.sql",
  import.meta.url,
);

test("Eckendahl field-photo migration preserves identity, adjacency, and pre-need semantics", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /TLC-HS-0328A/);
  assert.match(sql, /TLC-HS-0328/);
  assert.match(sql, /TLC-HS-0329/);
  assert.match(sql, /ST_LineInterpolatePoint/);
  assert.match(sql, /pink_granite/);
  assert.match(sql, /Bruce W Eckendahl/);
  assert.match(sql, /Terry M Eckendahl/);
  assert.match(sql, /pre_need_inscription/);
  assert.match(sql, /IMG_5918\.HEIC/);
  assert.match(sql, /IMG_5919\.HEIC/);
  assert.match(sql, /IMG_5920\.HEIC/);
  assert.match(sql, /horizontalPositioningErrorMeters/);
  assert.match(sql, /Existing estimated neighboring grave polygons overlap/);
});
