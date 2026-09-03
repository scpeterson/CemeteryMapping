import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/372-add-air-force-airman-second-class.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("Air Force rank lookup includes Airman Second Class", () => {
  assert.match(migration, /military_branch_types\.code = 'air_force'/u);
  assert.match(migration, /'a2c'/u);
  assert.match(migration, /'Airman Second Class'/u);
  assert.match(migration, /'A2C'/u);
  assert.match(migration, /'E-3'/u);
  assert.match(migration, /'enlisted'/u);
  assert.match(migration, /ON CONFLICT \(military_branch_type_id, code\) DO UPDATE/u);
});

test("Airman Second Class migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/372-add-air-force-airman-second-class\.sql/u);
});
