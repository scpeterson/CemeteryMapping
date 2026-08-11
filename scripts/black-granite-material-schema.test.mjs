import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/307-add-black-granite-material.sql", import.meta.url);
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);

test("marker materials include black granite", async () => {
  const [migration, changelog] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(changelogPath, "utf8"),
  ]);

  assert.match(migration, /'black_granite'/u);
  assert.match(migration, /'Black granite'/u);
  assert.match(migration, /ON CONFLICT \(code\) DO UPDATE/u);
  assert.match(changelog, /changes\/307-add-black-granite-material\.sql/u);
});
