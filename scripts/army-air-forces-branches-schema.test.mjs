import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../db/changelog/changes/250-add-army-air-forces-branches.sql", import.meta.url),
  "utf8",
);
const rankMigration = readFileSync(
  new URL("../db/changelog/changes/251-copy-air-force-ranks-to-army-air-forces.sql", import.meta.url),
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

test("both Army Air Forces branches receive the active Air Force rank set", () => {
  assert.match(rankMigration, /code IN \('army_air_forces', 'army_air_forces_base_unit'\)/u);
  assert.match(rankMigration, /military_branch_types\.code = 'air_force'/u);
  assert.match(rankMigration, /CROSS JOIN air_force_ranks/u);
  assert.match(rankMigration, /ON CONFLICT \(military_branch_type_id, code\) DO UPDATE/u);
  assert.match(rootChangelog, /changes\/251-copy-air-force-ranks-to-army-air-forces\.sql/u);
});
