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

test("parseNorthHillsOcrText accepts mixed-case OCR names and page footer punctuation", () => {
  const text = `Section C, Row 1
B[-1 (lC, 7, s) upright, gray granite, exc cond "F. B."
Balance of row, approximately 100 feet, is empty
Section C, Row 2
McWILLIAMS (2C, 1, s) pillow, gray granite, good cond, flower
"Brother/ Henry McWilllams / 1909-1965" CR: Middle Initial T., d.
December 16, 1965, 56y Sm 25da, "our janitor"
Franklin Park Borough               197                Allegheny County, PA
\fWISKEMAN (2C, 7, s) flat, gray granite military marker, exc cond,
cross "John G. Wiskeman / US Army/ World War II/ Jan 6 1926 Aug
26 2005 / Lovingly known as Jack"
HtEBER (2C, 8, c) upright, gray granite, exc cond, flowers, leaves
with basket weave "Hieber/ David L. / 1867-1940 /Father/ Anna C. /
1873-1949 / Mother" On back: "Hieber"
Franklin Park Borough                198   •          Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["B[-]", 197, "C", 1, 7],
      ["McWILLIAMS", 197, "C", 2, 1],
      ["WISKEMAN", 198, "C", 2, 7],
      ["HtEBER", 198, "C", 2, 8],
    ],
  );
  assert.equal(entries[1].rawText.includes("December 16, 1965"), true);
  assert.deepEqual(entries[3].parsedYears, [1867, 1873, 1940, 1949]);
});

test("parseNorthHillsOcrText accepts OCR brace and J for row three", () => {
  const text = `Section C, Row 3
WILL {JC, 1, c) upright, pink granite, exc cond, candles, flowers,
leaves "Will/ Albert R. / 1886-1959 /Father/   Elva Z. / 1889-1972 /
Mother" On back: "Will"
WILL (3C, 2, s) upright, gray granite, exc cond, tiny flowers "George
J. Will/ 1877-1952 / Father"
Franklin Park Borough               199                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["WILL", 199, "C", 3, 1, "couple"],
      ["WILL", 199, "C", 3, 2, "single"],
    ],
  );
  assert.deepEqual(entries[0].parsedYears, [1886, 1889, 1959, 1972]);
});
