import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("spatial validation uses exact active reviewed exceptions", async () => {
  const [migration, validationSql, validator] = await Promise.all([
    readFile(new URL("../db/changelog/changes/313-reviewed-spatial-validation-exceptions.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/validation/spatial-validation.sql", import.meta.url), "utf8"),
    readFile(new URL("./db-validate-spatial.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /reviewed_spatial_validation_exceptions_unique/u);
  assert.match(migration, /Migrated from the former blanket Trinity overlap allowance/u);
  assert.doesNotMatch(validationSql, /gravesite_id LIKE 'TLC-GPS-%'/u);
  assert.match(validationSql, /exception\.issue_detail = spatial_validation_issues\.issue_detail/u);
  assert.match(validator, /exception\.issue_detail = issue\.issue_detail/u);
  assert.match(validator, /exception\.expires_at > now\(\)/u);
});
