import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../db/changelog/changes/306-burial-name-suffix.sql", import.meta.url);
const changelogPath = new URL("../db/changelog/db.changelog-root.yaml", import.meta.url);

test("burials store name suffixes and professional credentials", async () => {
  const [migration, changelog] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(changelogPath, "utf8"),
  ]);

  assert.match(migration, /ADD COLUMN name_suffix text/u);
  assert.match(migration, /M\.D\./u);
  assert.match(changelog, /changes\/306-burial-name-suffix\.sql/u);
});
