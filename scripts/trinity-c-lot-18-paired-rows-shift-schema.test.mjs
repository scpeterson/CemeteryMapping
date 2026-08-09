import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../db/changelog/changes/297-shift-trinity-c-lot-18-paired-rows-south.sql", import.meta.url),
  "utf8",
);
const rootChangelog = fs.readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("paired Section C rows shift south together by 1.5 inches", () => {
  const expectedLots = [
    "100", "99", "98", "97", "96", "39", "19", "18", "17", "16", "15", "14", "13", "12", "11", "10",
    "95", "94", "93", "92", "91", "40", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
  ];

  for (const lotId of expectedLots) assert.match(migration, new RegExp(`'${lotId}'`, "u"));
  assert.match(migration, /1\.5 \* 0\.0254/u);
  assert.match(migration, /radians\(180\)/u);
  assert.match(migration, /ST_Translate\(target_lots\.geometry, 0, translation\.latitude_delta\)/u);
  assert.match(migration, /fixed marker TLC-HS-0312 falls inside lot C-18/u);
});

test("paired Section C row shift is included in the root changelog", () => {
  assert.match(rootChangelog, /changes\/297-shift-trinity-c-lot-18-paired-rows-south\.sql/u);
});
