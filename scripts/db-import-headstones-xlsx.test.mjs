import assert from "node:assert/strict";
import test from "node:test";
import { buildBurialNotes, buildSourceNotes, importableRows, upsertHeadstone, upsertHeadstoneGravesite } from "./db-import-headstones-xlsx.mjs";

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

test("importable spreadsheet rows omit North Hills fields when page is absent", () => {
  const [imported] = importableRows(
    [
      {
        rowNumber: 10,
        row: {
          Latitude: 40,
          Longitude: -80,
          Person1First: "Ida",
          Person1Last: "Wells",
          NhgSection: "C",
          NhgRow: "0",
          NhgPage: "0",
        },
      },
    ],
    {},
  );

  const notes = buildSourceNotes(imported);

  assert.equal(imported.nhgRow, null);
  assert.equal(imported.nhgPage, null);
  assert.equal(imported.sectionId, null);
  assert.doesNotMatch(notes, /North Hills Genealogists section/u);
  assert.doesNotMatch(notes, /North Hills Genealogists row/u);
  assert.doesNotMatch(notes, /North Hills Genealogists page/u);
});

test("importable spreadsheet rows generate 10 by 20 foot lots and 10 by 4 foot gravesites", () => {
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
  assert.equal(Number((lotWidth / graveWidth).toFixed(2)), 2);
  assert.equal(Number((lotHeight / graveHeight).toFixed(2)), 2.5);
});

test("section A through D gravesites place the headstone at the center of the left edge", () => {
  const [sectionC] = importableRows(
    [
      {
        rowNumber: 12,
        row: {
          Latitude: 40,
          Longitude: -80,
          Person1First: "Katherine",
          Person1Last: "Johnson",
          NhgSection: "C",
        },
      },
    ],
    {},
  );
  const [sectionE] = importableRows(
    [
      {
        rowNumber: 13,
        row: {
          Latitude: 40,
          Longitude: -80,
          Person1First: "Dorothy",
          Person1Last: "Vaughan",
          NhgSection: "E",
        },
      },
    ],
    {},
  );

  const sectionCRing = sectionC.geometry.coordinates[0][0];
  const sectionERing = sectionE.geometry.coordinates[0][0];
  const sectionCWest = sectionCRing[0][0];
  const sectionCEast = sectionCRing[1][0];
  const sectionESouthWest = sectionERing[0][0];
  const sectionENorthEast = sectionERing[2][0];

  assert.equal(Number(sectionCWest.toFixed(10)), -80);
  assert(sectionCEast > -80);
  assert.equal(Number(((sectionCRing[0][1] + sectionCRing[3][1]) / 2).toFixed(10)), 40);
  assert.equal(Number(((sectionESouthWest + sectionENorthEast) / 2).toFixed(10)), -80);
});

test("two-person left-edge markers generate side-by-side gravesites around the headstone", () => {
  const [imported] = importableRows(
    [
      {
        rowNumber: 166,
        row: {
          Latitude: 40,
          Longitude: -80,
          Person1First: "Charles",
          Person1Last: "Soergel",
          Person2First: "Ruth",
          Person2Last: "Soergel",
          NhgSection: "B",
        },
      },
    ],
    {},
  );

  assert.equal(imported.gravesites.length, 2);
  assert.equal(imported.gravesites[0].graveId, "0166A");
  assert.equal(imported.gravesites[1].graveId, "0166B");
  assert.equal(imported.gravesites[0].gravesiteId, "TLC-GPS-0166-01");
  assert.equal(imported.gravesites[1].gravesiteId, "TLC-GPS-0166-02");
  assert.equal(imported.gravesites[0].people[0].fullName, "Ruth Soergel");
  assert.equal(imported.gravesites[1].people[0].fullName, "Charles Soergel");

  const northRing = imported.gravesites[0].geometry.coordinates[0][0];
  const southRing = imported.gravesites[1].geometry.coordinates[0][0];

  assert.equal(Number(northRing[0][0].toFixed(10)), -80);
  assert.equal(Number(southRing[0][0].toFixed(10)), -80);
  assert.equal(Number(northRing[0][1].toFixed(10)), 40);
  assert.equal(Number(southRing[3][1].toFixed(10)), 40);
  assert(northRing[3][1] > southRing[0][1]);
});

test("two-person left-edge markers accept pluralized second-person headers", () => {
  const [imported] = importableRows(
    [
      {
        rowNumber: 167,
        row: {
          Latitude: 40,
          Longitude: -80,
          Person1First: "Roy R",
          Person1Last: "Soergel",
          Person1Yob: "1895",
          Person1Yod: "1974",
          Persons2First: "Ruby I",
          Persons2Last: "Soergel",
          Person2Yob: "1897",
          Person2Yod: "1994",
          NhgSection: "C",
        },
      },
    ],
    {},
  );

  assert.equal(imported.gravesites.length, 2);
  assert.equal(imported.gravesites[0].graveId, "0167A");
  assert.equal(imported.gravesites[0].gravesiteId, "TLC-GPS-0167-01");
  assert.equal(imported.gravesites[0].people[0].fullName, "Ruby I Soergel");
  assert.equal(imported.gravesites[0].people[0].birthDate, "1897");
  assert.equal(imported.gravesites[1].graveId, "0167B");
  assert.equal(imported.gravesites[1].gravesiteId, "TLC-GPS-0167-02");
  assert.equal(imported.gravesites[1].people[0].fullName, "Roy R Soergel");
  assert.equal(imported.gravesites[1].people[0].deathDate, "1974");
});

test("upsertHeadstoneGravesite restores soft-deleted marker links", async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };

  await upsertHeadstoneGravesite(client, "headstone-uuid", "gravesite-uuid", "spans");

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO headstone_gravesites/u);
  assert.match(calls[0].sql, /ON CONFLICT \(headstone_uuid, gravesite_uuid\) DO UPDATE/u);
  assert.match(calls[0].sql, /deleted_at = NULL/u);
  assert.deepEqual(calls[0].values, ["headstone-uuid", "gravesite-uuid", "spans"]);
});

test("headstone upserts preserve curated marker lookup values", async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ id: "headstone-uuid" }] };
    },
  };

  const headstoneUuid = await upsertHeadstone(
    client,
    {
      headstoneId: "TLC-HS-1",
      latitude: 40,
      longitude: -80,
      sourceProperties: { rowNumber: 12 },
    },
    "gravesite-uuid",
  );

  assert.equal(headstoneUuid, "headstone-uuid");
  assert.match(calls[0].sql, /marker_type_id/u);
  assert.match(calls[0].sql, /material_type_id/u);
  assert.match(calls[0].sql, /ELSE headstones\.marker_type_id/u);
  assert.match(calls[0].sql, /ELSE headstones\.material_type_id/u);
  assert.doesNotMatch(calls[0].sql, /marker_type_code/u);
  assert.doesNotMatch(calls[0].sql, /material_type_code/u);
});
