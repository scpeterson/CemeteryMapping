import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/250-add-army-air-forces-branches.sql", import.meta.url),
  "utf8",
);
const rootChangelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("military branch lookup includes both Army Air Forces values", () => {
  assert.match(migration, /'army_air_forces'/u);
  assert.match(migration, /'Army Air Forces'/u);
  assert.match(migration, /'army_air_forces_base_unit'/u);
  assert.match(migration, /'Army Air Forces Base Unit'/u);
  assert.match(migration, /ON CONFLICT \(code\) DO UPDATE/u);
});

test("Army Air Forces lookup migration is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/250-add-army-air-forces-branches\.sql/u);
});
