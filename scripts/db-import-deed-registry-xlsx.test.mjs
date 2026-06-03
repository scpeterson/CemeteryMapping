import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs";
import { parseRegistryRow, registryRows } from "./db-import-deed-registry-xlsx.mjs";

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

test("registryRows imports Investigated-style sheets from their header row and preserves note rows", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deed-registry-"));
  const filePath = join(directory, "investigated.xlsx");
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Investigated");
    worksheet.addRow(["Last Name", "First Name", "Address", "City", "State", "Lot num", "", "Remarks", "Last Known Date", "Deed on File", "Deed Register on File", "Book Match"]);
    worksheet.addRow(["Bladel", "Josephine K", "", "", "OH", "", "", "No Lot, no grave info.", "1951", "No", "No", ""]);
    worksheet.addRow(["", "", "", "", "", "Removed from Registry due to lack of evidence", "", "NHG Book p 233 lists a likely mismatch.", "", "", "", "No"]);
    await workbook.xlsx.writeFile(filePath);

    const rows = await registryRows(filePath, "Investigated");

    assert.equal(rows.length, 2);
    assert.equal(rows[0].rowNumber, 2);
    assert.equal(rows[0].rowType, "owner_record");
    assert.equal(rows[0].lot, null);
    assert.equal(rows[1].rowType, "investigation_note");
    assert.equal(rows[1].lot, null);
    assert.match(rows[1].remarks, /Removed from Registry/u);
    assert.deepEqual(rows[1].extraCells, { book_match: "No" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
