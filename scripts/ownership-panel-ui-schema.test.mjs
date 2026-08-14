import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailPanel = readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");

test("ownership addresses use the known state and territory list", () => {
  assert.match(detailPanel, /const stateOptions = \[/u);
  assert.match(detailPanel, /<select value=\{party\.state\}/u);
  assert.match(detailPanel, /\["PA", "Pennsylvania"\]/u);
  assert.match(detailPanel, /\["PR", "Puerto Rico"\]/u);
});

test("current ownership resolves owners returned with the selected gravesite", () => {
  assert.match(detailPanel, /\.\.\.\(grave\?\.owners \?\? \[\]\), \.\.\.owners/u);
});

test("current ownership shows the date and both deed-file statuses without internal right notes", () => {
  assert.match(detailPanel, /Date: \{owner\.effectiveDate/u);
  assert.match(detailPanel, /checked=\{owner\.deedOnFile/u);
  assert.match(detailPanel, /checked=\{owner\.deedRegisterOnFile/u);
  assert.match(detailPanel, /checked=\{form\.deedOnFile\}/u);
  assert.match(detailPanel, /checked=\{form\.deedRegisterOnFile\}/u);
});
