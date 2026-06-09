import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/063-create-trinity-c-lot-29.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 29 migration creates a reviewed lot north of the C-0172 passageway gravesites", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /'C-29'/u);
  assert.match(migration, /'29'/u);
  assert.match(migration, /TLC-GPS-0172-01/u);
  assert.match(migration, /ST_Transform\(c_0172a\.geometry, 2272\)/u);
  assert.match(migration, /ST_YMax\(Box2D\(ST_Transform\(c_0172a\.geometry, 2272\)\)\) \+ 2/u);
  assert.match(migration, /ST_YMax\(Box2D\(ST_Transform\(c_0172a\.geometry, 2272\)\)\) \+ 22/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
