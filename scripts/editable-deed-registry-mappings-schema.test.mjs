import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("deed registry mapping migration preserves source fields and adds editable overrides", async () => {
  const sql = await readFile(new URL("../db/changelog/changes/314-editable-deed-registry-mappings.sql", import.meta.url), "utf8");
  assert.match(sql, /modern_section/u);
  assert.match(sql, /corrected_lot_text/u);
  assert.match(sql, /mapping_updated_by/u);
  assert.doesNotMatch(sql, /DROP COLUMN.*raw_lot_text/u);
  assert.doesNotMatch(sql, /DROP COLUMN.*raw_section_text/u);
});

test("deed registry last-known-date migration adds a correction without replacing the imported date", async () => {
  const sql = await readFile(new URL("../db/changelog/changes/315-editable-deed-last-known-date.sql", import.meta.url), "utf8");
  assert.match(sql, /ADD COLUMN corrected_last_known_date date/u);
  assert.doesNotMatch(sql, /DROP COLUMN IF EXISTS last_known_date[;\s]/u);
});
