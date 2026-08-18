import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailPanel = readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");
const ownershipRecords = readFileSync(new URL("../src/components/detail/OwnershipRecords.tsx", import.meta.url), "utf8");

test("ownership addresses use the known state and territory list", () => {
  assert.match(ownershipRecords, /const stateOptions = \[/u);
  assert.match(ownershipRecords, /<select value=\{party\.state\}/u);
  assert.match(ownershipRecords, /\["PA", "Pennsylvania"\]/u);
  assert.match(ownershipRecords, /\["PR", "Puerto Rico"\]/u);
});

test("current ownership resolves owners returned with the selected gravesite", () => {
  assert.match(detailPanel, /\.\.\.\(grave\?\.owners \?\? \[\]\), \.\.\.owners/u);
});

test("current ownership shows the date and both deed-file statuses without internal right notes", () => {
  assert.match(ownershipRecords, /Date: \{owner\.effectiveDate/u);
  assert.match(ownershipRecords, /checked=\{owner\.deedOnFile/u);
  assert.match(ownershipRecords, /checked=\{owner\.deedRegisterOnFile/u);
  assert.match(ownershipRecords, /checked=\{form\.deedOnFile\}/u);
  assert.match(ownershipRecords, /checked=\{form\.deedRegisterOnFile\}/u);
});
