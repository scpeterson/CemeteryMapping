import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const correctionPath = new URL("../db/changelog/changes/107-correct-reviewed-shapefile-marker-associations.sql", import.meta.url);
const correction = readFileSync(correctionPath, "utf8");

test("corrected shapefile marker associations assign Robert Scott and James Crea to their own features", () => {
  assert.match(correction, /'TLC-HS-0038', -80\.07985615663071::numeric, 40\.60110700877493::numeric/u);
  assert.match(correction, /94::integer, '96', 'James H Crea; Ella R Pfeiffer'/u);
  assert.match(correction, /'TLC-HS-0045', -80\.07989350362502::numeric, 40\.601130868776124::numeric/u);
  assert.match(correction, /98::integer, '100', 'Robert G Scott'/u);
  assert.doesNotMatch(correction, /'TLC-HS-0045'.*Florence B Kind/u);
});

test("corrected shapefile marker associations document Florence Kind exclusivity", () => {
  assert.match(correction, /Feature 113 Florence B Kind should only be associated with TLC-HS-0059/u);
});
