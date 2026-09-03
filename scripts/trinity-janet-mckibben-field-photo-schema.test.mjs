import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const filename = "373-add-janet-mckibben-field-photo-marker.sql";
const sql = await readFile(new URL(`../db/changelog/changes/${filename}`, import.meta.url), "utf8");

test("Janet field record uses the overall sequence and linked records without changing neighbors", () => {
  for (const value of ["TLC-HS-0576", "TLC-GPS-0576", "'A', '0576'", "TLC-HS-0021", "TLC-HS-0022",
    "ST_LineInterpolatePoint", "INSERT INTO headstone_gravesites", "INSERT INTO headstone_burials",
    "INTO STRICT", "assert_migration_prerequisite"]) assert.ok(sql.includes(value), value);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|ON CONFLICT)\b/u);
  assert.doesNotMatch(sql, /0021A/u);
});

test("Janet identity and photo evidence preserve uncertainty", () => {
  for (const value of ["Janet Barczak McKibben", "1941-07-16", "2024-05-06", "IMG_6211.HEIC",
    "IMG_6212.HEIC", "horizontalPositioningErrorMeters", "RawExifGps", "'unknown'", "needs_review",
    "nhgInclusion", "importedGravesiteSpreadsheetInclusion", "not_listed"])
    assert.ok(sql.includes(value), value);
  assert.doesNotMatch(sql, /code = 'casket'/u);
});

test("Janet migration is registered", async () => {
  const root = await readFile(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");
  assert.ok(root.includes(`changes/${filename}`));
});

test("Janet migration skips absent imported source data without weakening partial-data checks", () => {
  assert.match(sql, /IF NOT EXISTS[\s\S]*TLC-GPS-0021[\s\S]*TLC-GPS-0022[\s\S]*THEN\s+RETURN;/u);
  assert.match(sql, /INTO STRICT cemetery_uuid/u);
  assert.match(sql, /INTO STRICT marker_point/u);
  assert.match(sql, /--validCheckSum 9:f2230dfce4d268cdfa1ca22e28642b9b/u);
});
