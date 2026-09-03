import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const filename = "376-add-built-in-vase-type.sql";
const sql = await readFile(new URL(`../db/changelog/changes/${filename}`, import.meta.url), "utf8");

test("built-in vase is a distinct active type with repeat-safe lookup insertion", () => {
  assert.match(sql, /'built_in', 'Built-in \/ integral vase'/u);
  assert.match(sql, /55, true/u);
  assert.match(sql, /ON CONFLICT \(code\) DO UPDATE/u);
});

test("Janet vase classification is targeted and preserves unrelated fields and notes", () => {
  assert.match(sql, /WHERE headstone_id = 'TLC-HS-0576' AND deleted_at IS NULL/u);
  assert.match(sql, /code = 'granite'/u);
  assert.match(sql, /code = 'attached_to_marker'/u);
  assert.match(sql, /assert_migration_prerequisite/u);
  assert.match(sql, /NULLIF\(vase_notes, ''\)/u);
  assert.doesNotMatch(sql, /SET\s+(?:geometry|source_properties|inscription)\s*=/u);
});

test("built-in vase migration is included", async () => {
  const root = await readFile(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
  assert.ok(root.includes(`changes/${filename}`));
});
