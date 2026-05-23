import assert from "node:assert/strict";
import test from "node:test";
import { buildBurialNotes, buildSourceNotes, importableRows } from "./db-import-headstones-xlsx.mjs";

test("headstone spreadsheet source notes use the corrected North Hills source name", () => {
  const imported = {
    rowNumber: 42,
    sectionId: "A",
    nhgRow: "7",
    nhgPage: "12",
    tlcSec: "Old",
    tlcPlot: "3",
    sourceGraveNumber: "99",
  };

  const notes = buildSourceNotes(imported);

  assert.equal(
    notes,
    "Imported from headstone spreadsheet row 42. North Hills Geneologists section: A. North Hills Geneologists row: 7. North Hills Geneologists page: 12. Trinity Lutheran Church section: Old. Trinity Lutheran Church plot: 3. Source grave number: 99.",
  );
  assert.doesNotMatch(notes, /North Hills Guide/u);
});

test("importable spreadsheet rows map Nhg columns into corrected source notes", () => {
  const importedRows = importableRows(
    [
      {
        rowNumber: 9,
        row: {
          Latitude: 40,
          Longitude: -80,
          Person1First: "Ada",
          Person1Last: "Lovelace",
          NhgSection: "B",
          NhgRow: "4",
          NhgPage: "22",
        },
      },
    ],
    {},
  );

  assert.equal(importedRows.length, 1);
  assert.equal(buildBurialNotes(buildSourceNotes(importedRows[0]), importedRows[0].people[0]), "Imported from headstone spreadsheet row 9. North Hills Geneologists section: B. North Hills Geneologists row: 4. North Hills Geneologists page: 22. Person column: 1.");
});
