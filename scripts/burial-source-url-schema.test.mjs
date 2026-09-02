import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../db/changelog/changes/366-add-burial-source-url.sql", import.meta.url), "utf8");
const changelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
const queries = readFileSync(new URL("../server/cemeteryBurialQueries.mjs", import.meta.url), "utf8");
const mutations = readFileSync(new URL("../server/cemeteryBurialMutations.mjs", import.meta.url), "utf8");
const mapper = readFileSync(new URL("../server/cemeteryMappers.mjs", import.meta.url), "utf8");
const detailPanel = readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");

test("burials have an optional source URL throughout the application", () => {
  assert.match(migration, /ADD COLUMN source_url varchar\(2000\)/u);
  assert.match(changelog, /changes\/366-add-burial-source-url\.sql/u);
  assert.match(queries, /burials\.source_url/u);
  assert.match(mutations, /source_url = \$\$\{sourceUrlParameter\}/u);
  assert.match(mapper, /sourceUrl: burial\.source_url/u);
  assert.match(detailPanel, /Information source URL/u);
  assert.match(detailPanel, /View information source/u);
});
