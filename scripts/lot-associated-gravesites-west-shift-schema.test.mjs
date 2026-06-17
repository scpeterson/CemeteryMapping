import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/099-shift-lot-associated-gravesites-west.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("lot-associated gravesite shift moves linked graves and C-0172A/B west only", () => {
  assert.match(migration, /UPDATE gravesites/u);
  assert.match(migration, /WHERE gravesites\.deleted_at IS NULL/u);
  assert.match(migration, /gravesites\.lot_uuid IS NOT NULL/u);
  assert.match(migration, /gravesites\.lot_id IS NOT NULL/u);
  assert.match(migration, /'TLC-GPS-0172-01'/u);
  assert.match(migration, /'TLC-GPS-0172-02'/u);
  assert.match(migration, /ST_Transform\(gravesites\.geometry, 2272\)/u);
  assert.match(migration, /ST_Translate\(/u);
  assert.match(migration, /\n\s*-1\.5,\n\s*0\n/u);
  assert.match(migration, /::geometry\(MultiPolygon, 4326\)/u);
  assert.doesNotMatch(migration, /UPDATE lots/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /UPDATE sections/u);
});
