import assert from "node:assert/strict";
import test from "node:test";
import { isVeteran, normalizeSearchText, veteranValues } from "../shared/recordNormalization.mjs";
import { toBurial } from "./cemeteryMappers.mjs";

test("search normalization folds accents, composition, case and surrounding whitespace", () => {
  for (const value of [" García ", "GARCÍA", "Garci\u0301a", "garcia"]) assert.equal(normalizeSearchText(value), "garcia");
  assert.equal(normalizeSearchText("O'Neill"), "o'neill");
  assert.equal(normalizeSearchText(undefined), "");
});
test("burial mapper shares the accepted veteran values with all SQL consumers", () => {
  for (const value of [...veteranValues, " VETERAN ", " Yes ", true, 1]) {
    assert.equal(isVeteran(value), true);
    assert.equal(toBurial({ veteran: value }).veteran, true);
  }
  for (const value of [undefined, null, "no", false, "0", "", "unknown"]) {
    assert.equal(isVeteran(value), false);
    assert.equal(toBurial({ veteran: value }).veteran, false);
  }
});
