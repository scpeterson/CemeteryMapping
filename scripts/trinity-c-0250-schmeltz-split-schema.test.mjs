import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/245-split-c-0250-schmeltz-gravesites.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("C-0250 creates south, center, and north Schmeltz gravesites", () => {
  assert.match(migration, /George H Schmeltz/u);
  assert.match(migration, /William A Schmeltz/u);
  assert.match(migration, /John A Schmeltz/u);
  assert.match(migration, /south_geometry/u);
  assert.match(migration, /center_geometry/u);
  assert.match(migration, /north_geometry/u);
  assert.match(migration, /TLC-GPS-0250-01/u);
  assert.match(migration, /TLC-GPS-0250-02/u);
});

test("C-0250 splits the combined burial using the marker inscription dates", () => {
  assert.match(migration, /full_name = 'William A Schmeltz'/u);
  assert.match(migration, /DATE '1874-01-01'/u);
  assert.match(migration, /DATE '1948-01-01'/u);
  assert.match(migration, /'John A Schmeltz'/u);
  assert.match(migration, /DATE '1876-01-01'/u);
  assert.match(migration, /DATE '1918-01-01'/u);
});

test("TLC-HS-0250 remains fixed and spans all three gravesites", () => {
  assert.doesNotMatch(migration, /UPDATE headstones\s+SET\s+geometry/iu);
  assert.match(migration, /headstones\.headstone_id = 'TLC-HS-0250'/u);
  assert.equal((migration.match(/'spans'/gu) ?? []).length >= 3, true);
});

test("C-0250 Schmeltz migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/245-split-c-0250-schmeltz-gravesites\.sql/u);
});
