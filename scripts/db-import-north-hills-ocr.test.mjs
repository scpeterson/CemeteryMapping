import assert from "node:assert/strict";
import test from "node:test";
import { parseNorthHillsOcrText } from "./db-import-north-hills-ocr.mjs";

test("parseNorthHillsOcrText stages row readings with raw OCR text and normalized coordinates", () => {
  const text = `Trinity German Evangelical Lutheran Church Cemetery

Trinity Readings and Records

Section A, Row 1
BURGESS (lA, 1, s) pillow, gray granite, exc cond "George L. / 1876-
1942 /Father" See Burgess monolith (2A, 6)

BURGESS/OPPERMAN (1A, 2, s) pillow, gray granite, exc cond "Mary
Opperman/ 1882-1946 / Mother"

Franklin Park Borough                   183                Allegheny County, PA
\fSection A, Row 2
SEEKE (2A, 1, c) upright, gray granite, exc cond, cross, leaves "Seeke
/Father/ Frederick/ 1876-1951 /Mother/ Marie/ 1874-19[blank]"
Franklin Park Borough                   184                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], {
    sourcePageIndex: 1,
    sourcePageNumber: 183,
    sourceLineStart: 6,
    sourceLineEnd: 7,
    rawText: 'BURGESS (lA, 1, s) pillow, gray granite, exc cond "George L. / 1876- 1942 /Father" See Burgess monolith (2A, 6)',
    nameText: "BURGESS",
    surnames: ["BURGESS"],
    parsedSectionName: "A",
    parsedRowNumber: 1,
    parsedPositionNumber: 1,
    parsedMarkerScope: "single",
    markerTypeText: "pillow",
    materialText: "granite",
    conditionText: "excellent",
    inscriptionText: "George L. / 1876- 1942 /Father",
    parsedYears: [1876, 1942],
    sourceEntry: {
      heading: 'BURGESS (lA, 1, s) pillow, gray granite, exc cond "George L. / 1876-',
      descriptor: "pillow, gray granite, exc cond",
    },
    parseConfidence: "high",
    parseNotes: [],
  });
  assert.deepEqual(entries[1].surnames, ["BURGESS", "OPPERMAN"]);
  assert.deepEqual(entries[2].parsedYears, [1874, 1876, 1951]);
  assert.equal(entries[2].parsedMarkerScope, "couple");
});

test("parseNorthHillsOcrText splits same-line readings and accepts period before marker scope", () => {
  const text = `Section A, Row 4
SCHRAMM (4A, 1, s) pillow, gray granite, exc cond "John W. Schramm/ 1886-1948" CR: d. May 3, 1948, 62y 2m 2da SCHRAMM/PFEIFFER (4A, 2. s) pillow, gray granite, exc cond "Lillian O. Schramm/ 1884-1968-" HARRIS/ POWELL ( 4A, 3, s) pillow, gray granite, exc cond "George Powell Harris/ 1909-1965"
Franklin Park. Borough                   185                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["SCHRAMM", "A", 4, 1, "single"],
      ["SCHRAMM/PFEIFFER", "A", 4, 2, "single"],
      ["HARRIS/ POWELL", "A", 4, 3, "single"],
    ],
  );
  assert.equal(entries[1].rawText, 'SCHRAMM/PFEIFFER (4A, 2. s) pillow, gray granite, exc cond "Lillian O. Schramm/ 1884-1968-"');
  assert.deepEqual(
    entries.map((entry) => entry.sourcePageNumber),
    [185, 185, 185],
  );
});
