import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/354-add-army-technician-fifth-grade.sql", import.meta.url),
  "utf8",
);
const changelog = fs.readFileSync(
  new URL("../db/changelog/db.changelog-root.yaml", import.meta.url),
  "utf8",
);

test("Army rank lookup includes Technician Fifth Grade", () => {
  assert.match(migration, /military_branch_types\.code = 'army'/u);
  assert.match(migration, /'t5'/u);
  assert.match(migration, /'Technician Fifth Grade'/u);
  assert.match(migration, /'T\/5'/u);
  assert.match(migration, /'E-5'/u);
  assert.match(migration, /'enlisted'/u);
  assert.match(migration, /ON CONFLICT \(military_branch_type_id, code\) DO UPDATE/u);
});

test("Technician Fifth Grade migration is included in the root changelog", () => {
  assert.match(changelog, /changes\/354-add-army-technician-fifth-grade\.sql/u);
});
