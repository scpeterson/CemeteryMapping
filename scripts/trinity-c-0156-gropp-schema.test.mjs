import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/309-split-c-0156-gropp-gravesites.sql", import.meta.url);
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);

test("C-0156 keeps Manfred south and assigns Alice to a new northern gravesite", async () => {
  const [migration, changelog] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(changelogPath, "utf8"),
  ]);

  assert.match(migration, /gravesites\.gravesite_id = 'TLC-GPS-0156'/u);
  assert.match(migration, /'Alice J\. Gropp'/u);
  assert.match(migration, /'0156A'/u);
  assert.match(migration, /'TLC-GPS-0156-01'/u);
  assert.match(migration, /Placed immediately north of retained TLC-GPS-0156 geometry/u);
  assert.match(migration, /relationship_type[\s\S]*'spans'/u);
  assert.match(migration, /headstones\.id = marker_context\.headstone_uuid/u);
  assert.doesNotMatch(migration, /SET\s+geometry\s*=.*headstones/iu);
  assert.match(changelog, /changes\/309-split-c-0156-gropp-gravesites\.sql/u);
});
