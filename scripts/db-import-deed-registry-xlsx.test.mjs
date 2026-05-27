import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistryRow } from "./db-import-deed-registry-xlsx.mjs";

test("parseRegistryRow treats Section G plot ranges as gravesite hints without promoting to lots", () => {
  const parsed = parseRegistryRow({
    lot: "G - 47-49",
    section: "",
    remarks: "",
  });

  assert.equal(parsed.parsedSectionName, "G");
  assert.equal(parsed.ownershipScope, "section_g_gravesite");
  assert.equal(parsed.parseConfidence, "high");
  assert.deepEqual(parsed.parsedPlotNumbers, ["47", "48", "49"]);
  assert.deepEqual(parsed.parsedGraveNumbers, ["47", "48", "49"]);
  assert(parsed.parseNotes.some((note) => note.includes("8 by 4 foot gravesites")));
  assert.deepEqual(
    parsed.allocations.map((allocation) => [allocation.allocationType, allocation.plotIdentifier, allocation.graveNumber]),
    [
      ["section_g_gravesite", "47", "47"],
      ["section_g_gravesite", "48", "48"],
      ["section_g_gravesite", "49", "49"],
    ],
  );
});

test("parseRegistryRow marks NA and OC lot ownership as ambiguous aliases", () => {
  const parsed = parseRegistryRow({
    lot: "52",
    section: "NA",
    remarks: "Records state 4 graves used",
  });

  assert.equal(parsed.parsedSectionName, null);
  assert.equal(parsed.parsedSectionAlias, "NA");
  assert.equal(parsed.ownershipScope, "grave_count_only");
  assert.deepEqual(parsed.parsedLotNumbers, ["52"]);
  assert.equal(parsed.parsedGraveCount, 4);
  assert(parsed.parseNotes.some((note) => note.includes("alternate section name")));
  assert(parsed.allocations.some((allocation) => allocation.allocationType === "grave_count" && allocation.graveCount === 4));
});

test("parseRegistryRow preserves passage records for manual spatial review", () => {
  const parsed = parseRegistryRow({
    lot: "Passage between 96-101",
    section: "",
    remarks: "2 graves",
  });

  assert.equal(parsed.ownershipScope, "passage");
  assert.equal(parsed.parseConfidence, "medium");
  assert.deepEqual(parsed.parsedLotNumbers, ["96", "97", "98", "99", "100", "101"]);
  assert(parsed.allocations.some((allocation) => allocation.allocationType === "passage"));
  assert(parsed.allocations.some((allocation) => allocation.allocationType === "grave_count" && allocation.graveCount === 2));
});

test("parseRegistryRow flags over-capacity grave counts for review", () => {
  const parsed = parseRegistryRow({
    lot: "35",
    section: "",
    remarks: "6 Graves combine 35 & 36",
  });

  assert.equal(parsed.parsedGraveCount, 6);
  assert(parsed.parseNotes.some((note) => note.includes("exceeds")));
});
