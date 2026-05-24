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
    "Imported from headstone spreadsheet row 42. North Hills Genealogists section: A. North Hills Genealogists row: 7. North Hills Genealogists page: 12. Trinity Lutheran Church section: Old. Trinity Lutheran Church plot: 3. Source grave number: 99.",
  );
  assert.doesNotMatch(notes, /North Hills Guide/u);
  assert.doesNotMatch(notes, /North Hills Geneologists/u);
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
  assert.equal(buildBurialNotes(buildSourceNotes(importedRows[0]), importedRows[0].people[0]), "Imported from headstone spreadsheet row 9. North Hills Genealogists section: B. North Hills Genealogists row: 4. North Hills Genealogists page: 22. Person column: 1.");
});

test("importable spreadsheet rows generate 10 by 20 foot lots and 4 by 10 foot gravesites", () => {
  const [imported] = importableRows(
    [
      {
        rowNumber: 11,
        row: {
          Latitude: 40,
          Longitude: -80,
          Person1First: "Grace",
          Person1Last: "Hopper",
          NhgSection: "C",
          TlcPlot: "17",
        },
      },
    ],
    {},
  );

  const graveRing = imported.geometry.coordinates[0][0];
  const lotRing = imported.lotGeometry.coordinates[0][0];
  const graveWidth = graveRing[1][0] - graveRing[0][0];
  const graveHeight = graveRing[2][1] - graveRing[1][1];
  const lotWidth = lotRing[1][0] - lotRing[0][0];
  const lotHeight = lotRing[2][1] - lotRing[1][1];

  assert.equal(imported.lotId, "17");
  assert.equal(Number((lotWidth / graveWidth).toFixed(2)), 5);
  assert.equal(Number((lotHeight / graveHeight).toFixed(2)), 1);
});
