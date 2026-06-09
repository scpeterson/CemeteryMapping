import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/064-create-trinity-c-lot-10.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C lot 10 migration creates a lot directly north of lot 29", () => {
  assert.match(migration, /INSERT INTO lots/u);
  assert.match(migration, /'C-10'/u);
  assert.match(migration, /'10'/u);
  assert.match(migration, /lots\.lot_id = '29'/u);
  assert.match(migration, /ST_YMax\(Box2D\(ST_Transform\(c_29\.geometry, 2272\)\)\)/u);
  assert.match(migration, /ST_YMax\(Box2D\(ST_Transform\(c_29\.geometry, 2272\)\)\) \+ 20/u);
  assert.doesNotMatch(migration, /UPDATE gravesites/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
});
