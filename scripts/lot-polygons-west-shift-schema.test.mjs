import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/098-shift-current-lot-polygons-west.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("current lot polygon shift moves active lots west without north-south movement", () => {
  assert.match(migration, /UPDATE lots/u);
  assert.match(migration, /WHERE lots\.deleted_at IS NULL/u);
  assert.match(migration, /ST_Transform\(lots\.geometry, 2272\)/u);
  assert.match(migration, /ST_Translate\(/u);
  assert.match(migration, /\n\s*-1\.5,\n\s*0\n/u);
  assert.match(migration, /::geometry\(MultiPolygon, 4326\)/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /UPDATE sections/u);
});
