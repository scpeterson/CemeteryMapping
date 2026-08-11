import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/308-military-decorations-and-navy-mm2.sql", import.meta.url);
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);

test("burials support reusable military decorations and the Navy MM2 rating", async () => {
  const [migration, changelog] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(changelogPath, "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE military_decoration_types/u);
  assert.match(migration, /CREATE TABLE burial_military_decorations/u);
  assert.match(migration, /'purple_heart', 'Purple Heart'/u);
  assert.match(migration, /'bronze_star_medal', 'Bronze Star Medal'/u);
  assert.match(migration, /'mm2'[\s\S]*'Machinist''s Mate Second Class'[\s\S]*'MM2'/u);
  assert.match(changelog, /changes\/308-military-decorations-and-navy-mm2\.sql/u);
});
