import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/062-shift-trinity-c-0172-passageway-gravesites.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");

test("Section C passageway migration shifts C-0172 gravesites north without moving the headstone", () => {
  assert.match(migration, /UPDATE gravesites/u);
  assert.match(migration, /lot_uuid = NULL/u);
  assert.match(migration, /lot_id = NULL/u);
  assert.match(migration, /ST_Transform\(gravesites\.geometry, 2272\)/u);
  assert.match(migration, /ST_Translate\(/u);
  assert.match(migration, /\n\s*0,\n\s*2\n/u);
  assert.match(migration, /TLC-GPS-0172-01/u);
  assert.match(migration, /TLC-GPS-0172-02/u);
  assert.doesNotMatch(migration, /UPDATE headstones/u);
  assert.doesNotMatch(migration, /TLC-HS-0172/u);
});
