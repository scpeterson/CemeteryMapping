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

test("parseNorthHillsOcrText splits page 184 Pfeiffer and Kelley readings after gap note", () => {
  const text = `Section A, Row 3
PFEIFFER (3A, 3, c) upright, gray granite·, exc _cond,flowers, basket- weave design "pfeiffer / Edward·G. / 1877-1967 / Edna M. j 1887- 1963" CR: Edward George, d. De.cember 18, 1.967, 90y 18da. Edna, d. January 27, 1963, 75y 3m 25da. Note: "Dr. J. J; Myers buried I . was in Florida" Gap, aoout 15 feet. KELlEY (3A, 4, s) flat, gray granite, exc cond, cross in circle "Paul S Kelley / A2C US Air Force,/ Vietnam / Feb:8 1940 May 17 1986" Funeral home marker: "Paul S Kelley/ 1940-1986 / Rlchard·D. Cole· Fune.ralHome" Sep?rate flag holder: "Korea US/ 1950-1955"
Franklin Park Borough                   184                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["PFEIFFER", "A", 3, 3, "couple"],
      ["KELlEY", "A", 3, 4, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("Gap, aoout 15 feet"), false);
  assert.equal(entries[0].rawText.includes("KELlEY"), false);
  assert.equal(entries[1].rawText.startsWith("KELlEY (3A, 4, s)"), true);
});

test("parseNorthHillsOcrText splits page 184 Brandt readings with OCR variants", () => {
  const text = `Section A, Row 3
BRANDT (3A, 5, s) flat, gray granite; exc cond, flower, leaves "Edward P. Brandt/ August 27~ 1877 / Sept. 17, 1963" BRANDT (3A, 6, s,) upright, gray granite, exc cond "Susan Br~ndt / - 1867 - [blank)" CR: Note: She is listed in funeral records between June 29 and November 15, 1956, but· there is no date of death. "Dr. Myers did not officiate~" ,-'
BRANDT (3A, 7, s) upright, gray granitei exc·cond "Margaret Brandt/ ·• 1871-1939." CR: Mlddle n~me Anna, d. October 28, 1939 ..
BRANDT (3A, 8, s) upright, gray granite, exc cond "Sophia Brandt/ 1869-1929" CR: d. March 13, 1929, 60y BRAND'r (3A, 9, c) upright, gray granite, exccond, flower, leaf, scrolls "Brandt/ Walter C. / 1882-1945 / Mary M. / 1882-1956" CR: Walter, d. March 18, 1945
Franklin Park Borough                   184                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 5);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["BRANDT", 184, "A", 3, 5, "single"],
      ["BRANDT", 184, "A", 3, 6, "single"],
      ["BRANDT", 184, "A", 3, 7, "single"],
      ["BRANDT", 184, "A", 3, 8, "single"],
      ["BRANDT", 184, "A", 3, 9, "couple"],
    ],
  );
  assert.equal(entries[0].rawText.includes("Susan"), false);
  assert.equal(entries[3].rawText.includes("BRAND'r"), false);
  assert.equal(entries[4].rawText.startsWith("BRAND'r (3A, 9, c)"), true);
  assert.deepEqual(entries[4].parsedYears, [1882, 1945, 1956]);
});

test("parseNorthHillsOcrText splits entries when OCR drops the comma before marker scope", () => {
  const text = `Section A, Row 2
STERTZ (2A, 4, c) upright, gray granite, exc cond, leaves, scroll, flower "Stertz / Alexander F. / Mar. 28, 1896 / Jan. 9, 1954 /Father/ Emma S. / Nov. 25, 1891 [blank]/ Mother" CR: Emma, d. Jan. 23, 1985 STERTZ (2A, 5 s) flat, bronze, exc cond "James F Stertz / AMN US Air Force/ Korea/ Sep 5 1928 / Nov 1 1984" Separate flag holder: "World War II / Veteran"
Franklin Park Borough                   183                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["STERTZ", "A", 2, 4, "couple"],
      ["STERTZ", "A", 2, 5, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("James F Stertz"), false);
  assert.equal(entries[1].rawText.startsWith("STERTZ (2A, 5 s)"), true);
});

test("parseNorthHillsOcrText trims inline page footers from final readings", () => {
  const text = `Section A, Row 5
PFEIFFER (SA, 1, c) upright, orange granite, exc cond "?feiffer / 1890 Harry R. 1986 / waiter H. / Nov. 7, 1886 / Sept. 2, 1973 / Lynn C. / June 7, 1894 / April 18, 1981" CR: Hany, middle name Ralph, Aug. 29, 1890 - Jan. 23, 1986 Franklin Park. Borough 185 Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 1);
  assert.deepEqual(
    [entries[0].nameText, entries[0].sourcePageNumber, entries[0].parsedSectionName, entries[0].parsedRowNumber, entries[0].parsedPositionNumber],
    ["PFEIFFER", 185, "A", 5, 1],
  );
  assert.equal(entries[0].rawText.includes("Franklin Park"), false);
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

test("parseNorthHillsOcrText splits Hamilton Woodruff after Ida Will", () => {
  const text = `Section C, Row 3
WILL (3C, 3, s) upright, gray granite, exc cond, tiny flowers "Ida V.
Will/ 1884-1930 / Mother"

HAMILTON/WOODRUFF         (JC, 4, s) upright, gray granite, exc cond,
flowers, cross "George W. Hamilton/ 1885-1944" CR: Middle name
Woodruff, d. August 29, 1944
Franklin Park Borough               199                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["WILL", 199, "C", 3, 3, "single"],
      ["HAMILTON/WOODRUFF", 199, "C", 3, 4, "single"],
    ],
  );
  assert.deepEqual(entries[0].parsedYears, [1884, 1930]);
  assert.deepEqual(entries[1].parsedYears, [1885, 1944]);
});

test("parseNorthHillsOcrText splits Hood Hamilton and Watenpool page 199 readings", () => {
  const text = `Section C, Row 3
HOOD/HAMILTON        (3C, 5, s) upright, gray granite, exc cond,
flowers, cross "Genevieve Hamilton /Hood/     1898-1988" CR: Sept. 1,
1898 - July 27, 1988, middle initital, L

WATENPOOL (JC, 6, s) upright, gray granite., exc cond, flowers
"Daughter/ Olive C. Watenpool / 1892-1935" CR: Middle name
Caroline, d. December 3, 1935 -
Franklin Park Borough               199                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["HOOD/HAMILTON", 199, "C", 3, 5, "single"],
      ["WATENPOOL", 199, "C", 3, 6, "single"],
    ],
  );
  assert.deepEqual(entries[0].parsedYears, [1898, 1988]);
  assert.deepEqual(entries[1].parsedYears, [1892, 1935]);
});

test("parseNorthHillsOcrText accepts corrected page 199 section C follow-up readings", () => {
  const text = `Section C, Row 2
HUBERT (2C, 14, c) upright, gray granite, exc cond, cross, roses &
leaves across top "Hubert / Regis T. / Dec. 16, 1935 / April 20, 1996"
Second side is blank. Bottom of stone: "Dedicated to God and their fellow
man." Small stone with engraved sprig of leaves in ground in front:
"Psalm 25" Separate flag holder: "US / Veteran", star. Vase in ground

PFEIFFER (2C, 16, s) upright with open ledger, gray granite, exc cond,
"Mary Pfeiffer / 1847-1904 / Asleep in Jesus"

Section C, Row 3
WATENPOOL (3C, 6, s) upright, gray granite, exc cond, flowers
"Daughter/ Olive C. Watenpool / 1892-1935" CR: Middle name Caroline, d.
December 3, 1935
Franklin Park Borough               199                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["HUBERT", 199, "C", 2, 14, "couple"],
      ["PFEIFFER", 199, "C", 2, 16, "single"],
      ["WATENPOOL", 199, "C", 3, 6, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("•"), false);
  assert.equal(entries[1].inscriptionText, "Mary Pfeiffer / 1847-1904 / Asleep in Jesus");
  assert.equal(entries[2].rawText.endsWith("-"), false);
});

test("parseNorthHillsOcrText splits Watenpool through Wiskeman page 200 readings", () => {
  const text = `Section C, Row 3
WATENPOOL (3C, 7, c) upright, gray, exc cond, flowers "Watenpool /
Peter/ 1859-1939 /Father/ A. Amelia/ 1868-1956 / Mother" On back
"Watenpool" CR: Peter, d. September 29, 1939. Anna Amelia, d. January
19, 1956, 87y 7m 27da DAVIS (JC, 8, s) pillow, pink granite, exc
cond, flowers, scroll "Pearle H. Davis/ 1901-1988" WILLS (JC, 9, s)
upright, gray granite, exc cond "'Aunt Bertie'/ Bertha L. Wills/
1895-1982" CR: Middle name Louise, d. March 17, 1982, 86y 9m 11da
WISKEMAN (JC, 10, s) upright, gray granite, exc cond "M. Elva Wiskeman
/ 1891-1978" CR: First name Marie, d. June 6, 1978, 87y 4m 4da
WISKEMAN/WHISKEMAN (JC, 11, s) upright, gray granite, exc cond "John
G. Wiskeman / 1896-1926" Separate flag holder: "American/ US/ Legion",
star CR: Whiskeman, d. August 9, 1926
Franklin Park Borough               200                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 5);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["WATENPOOL", 200, "C", 3, 7, "couple"],
      ["DAVIS", 200, "C", 3, 8, "single"],
      ["WILLS", 200, "C", 3, 9, "single"],
      ["WISKEMAN", 200, "C", 3, 10, "single"],
      ["WISKEMAN/WHISKEMAN", 200, "C", 3, 11, "single"],
    ],
  );
  assert.deepEqual(entries[0].parsedYears, [1859, 1868, 1939, 1956]);
  assert.deepEqual(entries[4].parsedYears, [1896, 1926]);
  assert.equal(entries[2].rawText.includes("86y 9m 11da"), true);
});

test("parseNorthHillsOcrText splits Wills siblings and Broerman Will page 200 readings", () => {
  const text = `Section C, Row 3
WILLS (3C, 12, s) pillow, gray granite, exc cond, grapes, leaves, church window "John H. Wills/ 1875-1956 / Brother" CR: Middle name Henry, d. June 29, 1956, 81y 4m 17da 'WILLS (3C, 13, s) pillow, gray granite, exc cond, grapes, leaves, church window "Frank E. Wills/ 1880-1927 / Brother" CR: d. December 18, 1927 WILLS/BROERMAN/WILL (JC, 14, c) upright, gray granite, exc cond, ornate scrollwork at top with "W" "WIiis / Frank Wills/ 1843- ..1926 / Elizabeth Wills/ 1849-1920" Separate flag holder: "GAR/ 1861 / 1865" CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920
Franklin Park Borough               200                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["WILLS", 200, "C", 3, 12, "single"],
      ["WILLS", 200, "C", 3, 13, "single"],
      ["WILLS/BROERMAN/WILL", 200, "C", 3, 14, "couple"],
    ],
  );
  assert.equal(entries[0].rawText.endsWith("81y 4m 17da"), true);
  assert.equal(entries[1].rawText.startsWith("WILLS (3C, 13, s)"), true);
  assert.deepEqual(entries[0].parsedYears, [1875, 1956]);
  assert.deepEqual(entries[1].parsedYears, [1880, 1927]);
  assert.deepEqual(entries[2].parsedYears, [1843, 1849, 1861, 1865, 1920, 1926]);
});

test("parseNorthHillsOcrText accepts corrected page 200 Soergel age text", () => {
  const text = `Section C, Row 3
SOERGEL (3C, 17, s) pillow, gray granite, exc cond "Susan Soergel /
1872-1966" CR: d. January 5, 1966, 93y 11m 17da. "Oldest member"
Franklin Park Borough               200                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].nameText, "SOERGEL");
  assert.equal(entries[0].sourcePageNumber, 200);
  assert.equal(entries[0].parsedSectionName, "C");
  assert.equal(entries[0].parsedRowNumber, 3);
  assert.equal(entries[0].parsedPositionNumber, 17);
  assert.equal(entries[0].rawText.includes("93y 11m 17da"), true);
});

test("parseNorthHillsOcrText accepts corrected page 201 section C readings", () => {
  const text = `Section C, Row 3
NESBITT/BARTZ/PINKERTON/NESBIT (3C, 23, s) upright, pink granite, good
cond "Nesbitt / Linda Bartz / 1949-1998 / Not gone, only gone before /
Hugh Pinkerton / 1938 [blank]" CR: Linda Nesbit Dec. 23, 1949 - July
24, 1998

Section C, Row 4
SOERGEL (4C, 1, s) upright, gray granite, exc cond, name on open book
"Floyd Soergel / 1896-1947 / Father" CR: Middle name Walter, d. June
16, 1947, 51y 1m 27da

HAGUE (4C, 4, s) upright, gray granite, exc cond, flower spray "Albert
E. Hague / 1880-1940" CR: Middle name Emil, d. December 10, 1940, 60y
8m 28da
Franklin Park Borough               201                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["NESBITT/BARTZ/PINKERTON/NESBIT", 201, "C", 3, 23, "single"],
      ["SOERGEL", 201, "C", 4, 1, "single"],
      ["HAGUE", 201, "C", 4, 4, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("About 35 feet to end of row"), false);
  assert.equal(entries[1].rawText.includes("51y 1m 27da"), true);
  assert.equal(entries[2].rawText.includes("60y 8m 28da"), true);
  assert.equal(entries[2].rawText.includes("Franklin Park Borough"), false);
});

test("parseNorthHillsOcrText splits corrected page 202 section C readings", () => {
  const text = `Section C, Row 4
HAGUE (4C, 5, s) upright, gray granite, exc cond, flower spray "Amanda
L. Hague / 1886-1929" CR: d. June 30, 1929

HAGUE/BROERMAN (4C, 6, c) upright, gray granite, exc cond, scroll, ivy
"Hague/ Jacob Hague/ 1841-1922 / Margaret Caroline, / His wife /
1841-1918" CR: Jacob, d. March 26, 1922, 80y 7m 3da. Caroline
Broerman, d. Sept. 14, 1918

SARVER (4C, 7, s) pillow, gray granite, exc cond "Father/ C. Dale Sarver
/ 1877-1944'' CR: Clarence Dale Sarver, d. January 5, 1944
TAYLOR/SARVER (4C, 8, s) pillow, gray granite, exc cond "Mother/ Olive
Sarver / Taylor / 1888-1967" CR: d. April 2, 1967, 78y 4m 10da NOTE:
Foundation stone(?), small concrete flat stone in ground, no inscription
BROERMAN/SCHARF (4C, 9, s) pillow, gray granite, exc cond "Mother /
Marie B. Broerman / 1854-1944" CR: Marie Scharf, d. November 25, 1944

HEINTZ (4C, 13, s) pillow, gray granite, exc cond, grapes "Jacob
Heinl:2,Jr /·1886-1949" CR: Jacob A., d. October 16, 1949, 63y 28da
SCHUG (4C, 14, c) flat, gray granite, exc cond, crosses "Schug / 1910
Emile J. 1994 / 1912 Hazel M. 1997"
ZIEGENTHALER (4C, 15, s) upright, gray granite, exc cond, ivy "Z /
George / Ziegenthaler / born / Jan. 7, 1859 / died / May 30, 1902 / At
rest"

WITTMER (4C, 16, s) pillow, gray granite, exc cond "William J. Wittmer /
1848-1923 / Father" CR: d. September 4, 1923, 78y 3m 15da
Franklin Park Borough               202                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 9);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["HAGUE", 202, "C", 4, 5, "single"],
      ["HAGUE/BROERMAN", 202, "C", 4, 6, "couple"],
      ["SARVER", 202, "C", 4, 7, "single"],
      ["TAYLOR/SARVER", 202, "C", 4, 8, "single"],
      ["BROERMAN/SCHARF", 202, "C", 4, 9, "single"],
      ["HEINTZ", 202, "C", 4, 13, "single"],
      ["SCHUG", 202, "C", 4, 14, "couple"],
      ["ZIEGENTHALER", 202, "C", 4, 15, "single"],
      ["WITTMER", 202, "C", 4, 16, "single"],
    ],
  );
  assert.equal(entries[1].rawText.includes("80y 7m 3da"), true);
  assert.equal(entries[3].rawText.includes("78y 4m 10da"), true);
  assert.equal(entries[3].rawText.includes("Foundation stone(?)"), true);
  assert.deepEqual(entries[6].parsedYears, [1910, 1912, 1994, 1997]);
  assert.equal(entries[7].inscriptionText.includes("Ziegenthaler"), true);
  assert.equal(entries[8].rawText.includes("78y 3m 15da"), true);
});

test("parseNorthHillsOcrText splits corrected page 203 section C readings", () => {
  const text = `Section C, Row 4
WITTMER/WITMER (4C, 17, s) pillow, gray granite, exc cond "Barbara
Wittmer/ 1854-1925 / Mother" CR: Barbara Witmer, d. & buried April 21,
1925

SARVER (4C, 18, c) upright, gray granite, exc cond, scroll, ivy "Philip
Sarver / 1858-1919 / Catherine, his wife / 1865-1927" CR: Philip B., d.
February 8, 1919, 61y. Catherine, d. January 27, 1927

HAGUE (4C, 20, c) upright, gray granite, exc cond, ivy "Hague/ Laverne
J. / 1897-1974 / Father / Clara H. / 1897-1948 / Mother" On back:
"Hague" CR: Laverne, d. June· 1, 1974

Section C, Row 5
SOERGEL (5C, 1, c) upright, gray granite, exc cond, flowers "Soergel /
Kenneth B. / Dec. 12, 1932 / Apr. 1993 / Clara Pearle / May 24, 1932
[blank]" On back: "Soergel" Separate flag holder: "US / Veteran" CR:
Kenneth, d. April 17, 1993

SOERGEL (5C, 2, c) flat, bronze, exc cond, roses "Howard L. / 1898-
1968 / Elsie G. / 1900-1986 / Soergel" CR: Howard, d, November 9, 1968,
70y 3m 7da. Elsie, Jan. 2, 1900 - September 15, 1986

SOERGEL (5C, 3, c) upright, gray granite, exc cond, rose "Soergel /
Wilbert J. / 1891-1968 / Father / Hazel A. / 1892-1983 / Mother" On
back: "Soergel" CR: Hazel, d. March 16, 1983, 90y 9m 21da

MURRAY (5C, 4, s) upright, gray granite, exc cond "M / Charles W. /
Murray / 1879-1919" On back: "Murray" CR: d. February 14, 1919

STEWART/MURRAY/WATENPOOL (5C, S, s) upright, gray, exc cond, flowers
"Mother/ Hilda Murray / Stewart / July 27, 1888 / June 13, 1970'' CR:
Hilda Watenpool Stewart, d. June 13, 1970

MURRAY (5C, 6, c) flat, gray granite, exc cond, flowers "Murray / C.
Wesley / Oct. 9, 1915 / Feb. 15, 2005 / Helen I. / May 23, 1913 / June
17, 2003" CR: Helen, birthdate, May 28

BLEAKLEY (5C, 7, c) upright, gray granite, exc cond, flowers "Bleakley/
Adam / 1875-1939 / Father/  Effie / 1885-1944 / Mother''
McCLELLAND/SARVER (5C, 8, s) upright, gray granite, exc cond "Clara R. /
Sarver / McClelland / 1868-1916" CR: d. January 28, 1916
Franklin Park Borough               203                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 11);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["WITTMER/WITMER", 203, "C", 4, 17, "single"],
      ["SARVER", 203, "C", 4, 18, "couple"],
      ["HAGUE", 203, "C", 4, 20, "couple"],
      ["SOERGEL", 203, "C", 5, 1, "couple"],
      ["SOERGEL", 203, "C", 5, 2, "couple"],
      ["SOERGEL", 203, "C", 5, 3, "couple"],
      ["MURRAY", 203, "C", 5, 4, "single"],
      ["STEWART/MURRAY/WATENPOOL", 203, "C", 5, 5, "single"],
      ["MURRAY", 203, "C", 5, 6, "couple"],
      ["BLEAKLEY", 203, "C", 5, 7, "couple"],
      ["McCLELLAND/SARVER", 203, "C", 5, 8, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("Barbara Witmer, d. & buried April 21, 1925"), true);
  assert.equal(entries[1].inscriptionText.includes("Catherine, his wife"), true);
  assert.equal(entries[5].inscriptionText.includes("Hazel A."), true);
  assert.equal(entries[7].rawText.includes("Hilda Watenpool Stewart"), true);
  assert.deepEqual(entries[9].parsedYears, [1875, 1885, 1939, 1944]);
  assert.deepEqual(entries[10].parsedYears, [1868, 1916]);
});

test("parseNorthHillsOcrText accepts corrected page 204 section C readings", () => {
  const text = `Section C, Row 5
HARRIS (5C, 9, s) flat, bronze, exc cond "Lester C Harris / Pfc US Army/
World War II / Aug 14 1926 Apr 16, 1989" CR: Middle name, Clyde

Section C, Row 6
WISKEMAN (6C, 1, c) upright, gray granite, exc cond, flower, leaves
"Wiskeman / William C. / 1898-1955 / Edith L. / 1900-1992" CR: W. C. d.
May 10, 1955 in Jonesboro, Ark., cremated and ashes buried June 6. Edith,
Oct. 12, 1900 - July 18, 1992

MURRAY (6C, 3, s) pillow, gray granite, exc cond "Infant son of / Martha
& Herbert / Murray / died 1945" CR: Jeffry Herbert Murray, d. September
29, 1945, 2 ½ da

SOERGEL (6C, 6, s) upright, gray granite, exc cond, flower, leaves
"Mother / Marie C. Soergel / July 8, 1897 / May 2, 1989"

FORD/RHODES (6C, 8, s) upright, gray granite, exc cond, flower, leaves
"Hanna Ford / June 10, 1893 / Sept. 5, 1953 / Mother" CR: Mrs. Hannah
Rhodes Ford

FORD (6C, 9, s) upright, gray granite, exc cond, flower, leaves "John E.
Ford / 1885-1971"
Franklin Park Borough               204                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 6);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["HARRIS", 204, "C", 5, 9, "single"],
      ["WISKEMAN", 204, "C", 6, 1, "couple"],
      ["MURRAY", 204, "C", 6, 3, "single"],
      ["SOERGEL", 204, "C", 6, 6, "single"],
      ["FORD/RHODES", 204, "C", 6, 8, "single"],
      ["FORD", 204, "C", 6, 9, "single"],
    ],
  );
  assert.deepEqual(entries[0].parsedYears, [1926, 1989]);
  assert.equal(entries[1].inscriptionText.includes("Wiskeman / William C."), true);
  assert.equal(entries[2].rawText.includes("2 ½ da"), true);
  assert.equal(entries[3].inscriptionText.includes("Marie C. Soergel"), true);
  assert.equal(entries[4].rawText.includes("Mrs. Hannah Rhodes Ford"), true);
  assert.deepEqual(entries[5].parsedYears, [1885, 1971]);
});

test("parseNorthHillsOcrText splits corrected page 205 section C readings", () => {
  const text = `Section C, Row 6
FORD/BERINGER (6C, 10, s) upright, gray granite, exc cond, band lozenges
"Mother / Amelia E. Beringer / wife of / John E. Ford / 1882- 1916" CR:
d. November 30, 1916

HIEBER (6C, 12, c) pillow, gray granite, exc cond, cross, grapes, leaves
"Hieber / George / 1865-1936 / Olive / 1871-1953"

HIEBER (6C, 13, s) pillow, gray granite, exc cond "George W. Hieber / T /
Sgt. 244th BU AAF / enlisted / Oct. 9, 1942 / born Oct. 28, 1906 /
discharged / Oct 11, 1945 / died May 13, 1961" Separate flag holder:
"World War II, eagle

SARVER/BROERMAN (6C, 14, c) upright, gray granite, exc cond, candle,
flowers, leaves "Sarver / James M. / 1871-1948 / Father /  Margaret E. /
1873-1958 / Mother" CR: James, d. February 26, 1948, 75y 2mo. Margaret
Broerman Sarver, d. December 7, 1958, 85y 1m 27d

SCHUESSLER (6C, 15, s) upright, gray granite, exc cond, cross, lily,
leaves "Armella 'June' / Schuessler / Sept. 30, 1936 / Sept. 10, 1984 /
Beloved wife & mother" Black wrought Iron plant holder

BROERMAN (6C, 16, s) upright, gray granite, exc cond "Harry T. Broerman /
1891-1923 / Sargt. Co. C 8, Field Div. / Signal Corps" Separate flag
holder: "American / US / Legion", star CR: Harry Theodore, d. November
7, 1923, 33y 8m 13da

BERINGER (6C, 18, s) upright, gray granite, exc cond, scrolls, flower in
window "Balthasar / Beringer / 1847-1925" CR: Baltzar, d. January 11,
1925, 77y 7m 23da

BERINGER (6C, 19, s) upright, gray granite, exc cond, scrolls "Katherine
/ Beringer 1859-1943" CR: d. January 17, 1943
Franklin Park Borough               205                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 8);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["FORD/BERINGER", 205, "C", 6, 10, "single"],
      ["HIEBER", 205, "C", 6, 12, "couple"],
      ["HIEBER", 205, "C", 6, 13, "single"],
      ["SARVER/BROERMAN", 205, "C", 6, 14, "couple"],
      ["SCHUESSLER", 205, "C", 6, 15, "single"],
      ["BROERMAN", 205, "C", 6, 16, "single"],
      ["BERINGER", 205, "C", 6, 18, "single"],
      ["BERINGER", 205, "C", 6, 19, "single"],
    ],
  );
  assert.equal(entries[0].inscriptionText.includes("Amelia E. Beringer"), true);
  assert.deepEqual(entries[1].parsedYears, [1865, 1871, 1936, 1953]);
  assert.deepEqual(entries[2].parsedYears, [1906, 1942, 1945, 1961]);
  assert.equal(entries[3].rawText.includes("85y 1m 27d"), true);
  assert.equal(entries[4].rawText.includes("Plot marker"), false);
  assert.equal(entries[5].rawText.includes("33y 8m 13da"), true);
  assert.deepEqual(entries[6].parsedYears, [1847, 1925]);
  assert.deepEqual(entries[7].parsedYears, [1859, 1943]);
});

test("parseNorthHillsOcrText accepts corrected page 206 section C readings", () => {
  const text = `Section C, Row 7
SCHARF/HAYS (7C, 3, c) flat, red granite, exc cond, lilac, rose "Edward
C. / May 14, 1900 / July 11, 1980 / Son / Glenn S. / Scharf / Jan. 1,
1932 / Nov. 11, 1998 / Katherine A. / June 10, 1900 / Feb. 11, 1975"
CR: Mrs. Katherine Hays Scharf

DUNBAR (7C, 5, s) upright, gray granite, exc cond, flower, leaves
''George R. Dunbar/ Sept. 5, 1872 / Feb. 29, 1932"

HAGUE/HAGUR/SKILES (7C, 11, c) upright, gray granite, exc cond, lilies
"H / Edward G. Hague / 1874-1923 / Amelia, his wife / 1877- 1915" CR:
Edward George Hagur, d. August 14, 1923, 48y 5m 4da. Amelia Skiles, d.
October 27, 1915

DERSTINE (7C, 12, s) flat, bronze, exc cond, cross "John E. Derstine /
T Sgt US Army / World War II / July 20 1919 - Aug 25 1997" Separate flag
holder: "1941 World War II 1942", eagle. Six inch Celtic cross by stone

DERSTINE (7C, 13, s) flat, bronze, exc cond "Elizabeth S. Derstine /
Beloved wife Mother / Grandmother and Greatgrandmother / June 11, 1920 -
Mar.23, 2005" Tombstone is at foot of (7C, 12) grave
Franklin Park Borough               206                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 5);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["SCHARF/HAYS", 206, "C", 7, 3, "couple"],
      ["DUNBAR", 206, "C", 7, 5, "single"],
      ["HAGUE/HAGUR/SKILES", 206, "C", 7, 11, "couple"],
      ["DERSTINE", 206, "C", 7, 12, "single"],
      ["DERSTINE", 206, "C", 7, 13, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("?C"), false);
  assert.equal(entries[0].inscriptionText.includes("Glenn S. / Scharf"), true);
  assert.equal(entries[1].rawText.includes("(7C, 5, s)"), true);
  assert.equal(entries[1].rawText.includes("(7C, S, s)"), false);
  assert.equal(entries[2].rawText.includes("48y 5m 4da"), true);
  assert.equal(entries[3].inscriptionText.includes("T Sgt US Army"), true);
  assert.equal(entries[3].rawText.includes("1942H"), false);
  assert.equal(entries[4].inscriptionText.includes("Elizabeth S. Derstine"), true);
  assert.deepEqual(entries[4].parsedYears, [1920, 2005]);
});

test("parseNorthHillsOcrText splits corrected page 207 section C readings", () => {
  const text = `Section C, Row 7
MORAN/ DERSTINE (7C, 14, s) flat, bronze, exc cond, oak leaves "Ruby M.
Moran / 11-11-11 wife 8-17-80" CR: Middle name Mae, sister of Betty Derstine

STIRLING (7C, 15, s) pillow, gray granite, exc cond "Anna E. Stirling /
1906-1952 / Daughter"

HARPER (7C, 17, s) pillow, gray granite, exc cond "Elsie K. Harper /
1903-1947 / Daughter"

Section C, Row 8
EADIE (8C, 1, s) flat, white marble, cross "William L Eadie / Pfc US
Army / WW II Bronze Star Medal / Jan 8 1926 Jul 12 2004 / God Bless You
& Yours / See you in Heaven - - Bill" CR: Believed to be in plot • with
Hilda G. Eadie (9C, 4)

KNOBLOCH (8C, 2, s) plllow, gray granite, exc cond "George R. Knobloch /
1874-1916 / Father" CR: d. June 24, 1916

KNOBLOCH (8C, 3, s) pillow, gray granite, exc cond "Sara C. Knobloch /
1881-1964 / Mother''

KNOBLOCH (8C, 4, monolith) upright, gray granite, exc cond, flowers
"Knobloch" On back: "Knobloch" Behind (8C, 5)

KNOBLOCH (8C, 5, s) pillow, gray granite, exc cond "John W. Knobloch /
1915·1918 / Son" In front of monolith (8C, 4)

HARPER (8C, 6, s) pillow, gray granite, exc cond "Carl N. Harper /
1931-1933 / Grandson"

HARPER (8C, 7, s) pillow, gray granite, exc cond "Edwin B. Harper/ Sgt.
Btry. D 2nd F. A. R. D. / enlisted / July 26, 1918 / discharged / Apr.
16, 1919 / born May 5, 1897 / died June 7, 1939" Separate flag holder:
"American / US / Legion", star in circle

SOERGEL/HILLMAN (8C, 8, c) upright, gray granite, exc cond "Soergel /
Peter Soergel / 1862-1936 / Margaret M. His Wife/ 1862- 1919" CR:
Peter, d. November 18, 1936. Margaret Hillman Soergel d. Jan. 30, 1919
Franklin Park Borough               207                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 11);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["MORAN/ DERSTINE", 207, "C", 7, 14, "single"],
      ["STIRLING", 207, "C", 7, 15, "single"],
      ["HARPER", 207, "C", 7, 17, "single"],
      ["EADIE", 207, "C", 8, 1, "single"],
      ["KNOBLOCH", 207, "C", 8, 2, "single"],
      ["KNOBLOCH", 207, "C", 8, 3, "single"],
      ["KNOBLOCH", 207, "C", 8, 4, "monolith"],
      ["KNOBLOCH", 207, "C", 8, 5, "single"],
      ["HARPER", 207, "C", 8, 6, "single"],
      ["HARPER", 207, "C", 8, 7, "single"],
      ["SOERGEL/HILLMAN", 207, "C", 8, 8, "couple"],
    ],
  );
  assert.equal(entries[0].rawText.includes("STIRLING"), false);
  assert.deepEqual(entries[1].parsedYears, [1906, 1952]);
  assert.equal(entries[2].rawText.includes("About 55 feet"), false);
  assert.equal(entries[3].rawText.includes("Bronze Star Medal"), true);
  assert.equal(entries[6].markerTypeText, "upright");
  assert.equal(entries[8].rawText.includes("(SC"), false);
  assert.equal(entries[9].rawText.includes("American / US / Legion"), true);
  assert.equal(entries[10].nameText, "SOERGEL/HILLMAN");
});

test("parseNorthHillsOcrText splits corrected page 208 section C readings", () => {
  const text = `Section C, Row 8
KUMMER (8C, 9, c) upright, gray granite, exc cond, flowers "Kummer /
George H. / 1860-1903 / Father / Margaret E. / 1870-1959 / Mother /
Chester T. / 1901-1921 / Son" On back: "Kummer" CR: Margaret, d.
January 16, 1959, 88y 9m 10da

KUMMER (8C, 10, s) upright, gray granite, exc cond "Dora Kummer /
1826-1926" On common base with (8C, 11). CR: Dorothy, d. September 18,
1926

KUMMER (8C, 11, s) upright, gray granite, exc cond "Christ Kummer /
1827-1895" On common base with (BC, 10). CRG: Christian Kummer, b. 16
March 1827 in Krahenbhal. Al Württemberg, d. 22 February 1895, age 67y
11m 8da, f. February 22, 1895

Section C, Row 9
GRAHAM/STEELE (9C, 1, s) upright, gray granite, exc cond, flowers "Mother
/ 1897·1973 / Pearl Steele / Graham / God bless you" CR: d. April 19,
1973, 76y 1m 24da

BROERMAN (9C, 3, s) pillow, bronze over stone, poor cond, US American
Legion rosette "Joseph L. Broerman/ Private / Co. 1 / 161st / Infantry /
enlisted July 23, 1918 discharged Mar. 4, 1919 / born June 14, 1886 died
July 4, 1934"

EADIE (9C, 4, s) flat, pink granite, exc cond, cross, flowers "Hilda G.
Eadie/ Nov. 18, 1929 / Aug. 28, 1988 / Beloved Mother / and Stepmother''
Franklin Park Borough               208                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 6);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["KUMMER", 208, "C", 8, 9, "couple"],
      ["KUMMER", 208, "C", 8, 10, "single"],
      ["KUMMER", 208, "C", 8, 11, "single"],
      ["GRAHAM/STEELE", 208, "C", 9, 1, "single"],
      ["BROERMAN", 208, "C", 9, 3, "single"],
      ["EADIE", 208, "C", 9, 4, "single"],
    ],
  );
  assert.deepEqual(entries[0].parsedYears, [1860, 1870, 1901, 1903, 1921, 1959]);
  assert.equal(entries[1].rawText.includes("(SC"), false);
  assert.equal(entries[2].rawText.includes("Württemberg"), true);
  assert.equal(entries[3].rawText.includes("76y 1m 24da"), true);
  assert.equal(entries[4].rawText.includes("seated child"), false);
  assert.equal(entries[5].rawText.includes("N.ov."), false);
});

test("parseNorthHillsOcrText detects page number when OCR joins Franklin Park footer", () => {
  const text = `Section A, Row 6
SCOTT (6A, 4, s) pillow, pink granite, exc cond, flowers "Son/ Donald
A. Scott/ 1923-1934"

KIND (7A, 6, s) upright, gray granite, exc cond, border, flower
"Mother/ Florence B. / Kind/ 1908-2002" CR: Aug. 3, 1908 - Nov. 31,
2002 FranklinPark Borough 187 Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["SCOTT", 187, "A", 6, 4],
      ["KIND", 187, "A", 7, 6],
    ],
  );
  assert.equal(entries[1].rawText.endsWith("Allegheny County, PA"), false);
});

test("parseNorthHillsOcrText detects page number when OCR reads Park as Parle", () => {
  const text = `OPPERMAN (1B, 6, c) upright, gray granite, exc cond, flowers
"Opperman/ Caroline M. / 1887-1966 / Ida 0. / 1884-1924" On back:
"Opperman/ Carl/ 1892-1893 / Anna A. / 1889-1899 / Mary 5. /
1858-1909 /William/ 1880-1953"

MASHEY /GOLLMAR (2B, 9, c) upright, gray granite, exc cond,
flowers, leaves "M / Amos Mashey 1839-1912 / Mary, his wife/ 1845-
1911 / Mashey" On back: "M" CR: Amos, d. July 3, 1912. Mary
Gollmar Mashey, d. April 24, 1911
Franklin Parle Borough               191                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["OPPERMAN", 191, "B", 1, 6],
      ["MASHEY /GOLLMAR", 191, "B", 2, 9],
    ],
  );
  assert.equal(entries[1].rawText.includes("Franklin Parle Borough"), false);
});

test("parseNorthHillsOcrText accepts accented and bracketed NHG headings on page 191", () => {
  const text = `MILLER/MÜLLER (2B, 3, c) obelisk, gray marble, good cond
"John / Miller / 1803-1875 / Mary Miller / 1810-1902" CRG: Johannes Müller,
b. 24 June 1803, d. 20 April 1876, age 73y, f. 22 April. He was from
Dudenhofen, Kreis Wetzlar, Prussia

[DEER] (2B, 4, s) upright, small white marble, poor cond "Mother"
See Deer family obelisk, (2B, 5)

DEER (2B, 5, c) obelisk, white marble, poor cond. On front: "F. Myrtle /
Deer / 1871-1898 / Nannie N /Deer/ 1868-1905" On left: "Mary, / wife of /
Wm Deer, / born / Oct. 20, 1838 / died / June 8, 1893 / Weep not she is not /
dead, but sleepeth" On back: "William / Deer, / born / Sep. 3, 1828 / died /
Sep. 22, 1911" CR: William, d. Sept. 24, 1911. SK: F. Myrtle, d. 1895 Note:
See marker for Nannie at (1B, 4) and for Myrtle at (1B, 5)

[DEER] (2B, 6, s) upright, small white marble, poor cond "Father"
See Deer family obelisk, (2B, 5)
Franklin Park Borough               191                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.equal(entries.length, 4);
  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["MILLER/MÜLLER", 191, "B", 2, 3],
      ["[DEER]", 191, "B", 2, 4],
      ["DEER", 191, "B", 2, 5],
      ["[DEER]", 191, "B", 2, 6],
    ],
  );
  assert.deepEqual(entries[0].surnames, ["MILLER", "MÜLLER"]);
  assert.deepEqual(entries[1].surnames, ["DEER"]);
  assert.equal(entries[2].rawText.includes("[DEER] (2B, 6"), false);
});

test("parseNorthHillsOcrText splits corrected page 192 row two readings", () => {
  const text = `MASHEY (2B, 10, s) flat, bronze, exc cond, leaves
"William A. Mashey / Feb. 12, 1891 Nov. 11, 1973"

STEIGERWALD (2B, 11, s) upright, gray marble, poor cond, sunken,
fallen "Andrew / Steigerwald / born / June 16, 1887 / died / June 3,
1896 / At rest" SK: June 16, 1867 - June 8, 1896

STEIGERWALD (2B, 12, s) upright, poor cond, sunken, fallen
"Hier ruht in Gott / Johann Steigerwald / geboren in / [ -] / [ -] Baiern /
22 Marz 1819 / gestorben / 19 Marz 1885" CRG: Steigerwald, Johann from
Partenstein Bavaria, b. 22 March 18(?), d. 18 March 1885, age 65y llm 27da,
f. March 21

BRANDT (2B, 14, s) upright with open ledger, gray granite, exc cond
"Sophia Brandt / 1839-1922 / At rest / Mother" CR: Mrs. Philip,
d. December 2, 1922, 83y 5m 9da

CUPPS/BRANDT (2B, 15, s) upright, gray granite, exc cond, sunken, fallen,
leaves "C / Catherine / wife of / George Cupps, / born May 1, 1864 /
died Nov. 25, 1891" CRG: Katharina Cupps nee Brandt, b. 1 May 1864
Allegheny Co., married 2 April 1888, d. 25 November 1891, age 27y 5m 25da,
f. November 28

WALLSCMIEDT/WALDSCHMIDT (2B, 16, s) upright, white marble, poor cond,
sunken, fallen, clasped hands "Hier Ruth / Katharina / Wallscmiedt / Geb,
1 Mai 1810 / Gest, 11, Juli/ 1878 / [illegible lines)" CRG: Katharina
Waldschmidt, b. 10 May 1810, f. July 13, 1878, d. 11 July at about 8:30 pm,
age 67y 2m 11d

GROETZINGER (2B, 17, s) upright, gray granite, exc cond
"Christopher/ Groetzinger / 1827-1902 / Father"

GROETZINGER/GERBIG (2B, 18, s) upright, gray granite, exc cond
"Sarah Groetzinger / 1832-1909 / Mother" CR: d. May 12, 1909. Mrs. Sarah
Gerbig Groetzinger

GROETZINGER/GERWIG (2B, 19, s) upright, gray granite, exc cond
"G / Emil Albert / Groetzinger / born / Jan. 18, 1858: / died /
Nov. 14, 1884 / 'For his soul pleased the Lord / Therefore hasted He to
take him / Away from amoung the wicked" CRG: Emil Albert Groetzinger, son of
Christoph & Sarah nee Gerwig, b. 13 January 1838 in Westmoreland Ct,
f. November 16, 1884, d. 14 November, age 26y, 9m, 27d
Franklin Park Borough               192                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["MASHEY", 192, "B", 2, 10],
      ["STEIGERWALD", 192, "B", 2, 11],
      ["STEIGERWALD", 192, "B", 2, 12],
      ["BRANDT", 192, "B", 2, 14],
      ["CUPPS/BRANDT", 192, "B", 2, 15],
      ["WALLSCMIEDT/WALDSCHMIDT", 192, "B", 2, 16],
      ["GROETZINGER", 192, "B", 2, 17],
      ["GROETZINGER/GERBIG", 192, "B", 2, 18],
      ["GROETZINGER/GERWIG", 192, "B", 2, 19],
    ],
  );
});

test("parseNorthHillsOcrText splits corrected page 193 Pfeiffer readings", () => {
  const text = `PFEIFFER/PFEIFER (3B, 1, c) upright, gray granite, exc cond, flower, leaves,
lattice "Pfeiffer / Jacob/ 1858-1954 / Father / Pauline A. / 1863-1945 /
Mother" On base: "Rock of Ages" in circle. On back: "Pfeiffer" CR: Jacob,
d. July 22, 1954. Mrs. Jacob Pfeifer (Pauline), d. October 11, 1945

PFEIFFER (3B, 2, s) upright, gray granite, exc cond, palm leaf
"Howard E. / Pfeiffer / 1903-1905"

PFEIFFER (3B, 5, s) upright, gray granite, exc cond ''Gotlieb Pfeiffer /
May 21, 1821 / Feb. 25, 1889 / Father" CRG: Gottlieb Pfeifer b. 21 May
in Lautbomsar Kussel (Rhein Baiern), f. February 27, 1889, d. 25 February,
age 67y 9m 4d

PFEIFFER (3B, 6, s) upright, gray granite, exc cond "Anna Dorothea/
wife of / Gotlieb Pfeiffer / Aug. 12, 1816 / Mar, 7, 1888 / Wife"

PFEIFFER/SCHULZ (3B, 7, s) upright, gray granite, exc cond "Caroline M.
Schulz/ wife of / John Pfeiffer / Oct. 28, 1854 / Oct. 21, 1879 / Mother /
In labour and in love allied, / In death they here sleep side by side /
Resting in peace - the aged twain - / Till Christ shall raise them up again"

PFEIFFER/BRANDT (3B, 8, c) upright, gray granite, exc cond, scrolls
"Pfeiffer/ George/ 18,51-1887 / Regina, / 1853-1930" CRG: Geo.,
f. December 10, 1887, age 36y, 9m, 15d. CR: Regina Brandt Pfeiffer,
d. September 8, 1930, 77y 7m 5da

ROBINSON/PFEIFFER (3B, 9, s) upright, gray granite, exc cond, picket fence,
leaves, scrolls "Amanda Pfeiffer / Robinson / 1876-1960" CR: d. February 22,
1960, 84y 1m 7da

PFEIFFER (3B, 10, s) upright, gray granite, exc cond, picket fence, leaves,
scrolls "Albert F. Pfeiffer / 1882-1963" CR: d. November 15, 1963,
81y 1m 16da. Lived with Ernest
Franklin Park Borough               193                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["PFEIFFER/PFEIFER", 193, "B", 3, 1],
      ["PFEIFFER", 193, "B", 3, 2],
      ["PFEIFFER", 193, "B", 3, 5],
      ["PFEIFFER", 193, "B", 3, 6],
      ["PFEIFFER/SCHULZ", 193, "B", 3, 7],
      ["PFEIFFER/BRANDT", 193, "B", 3, 8],
      ["ROBINSON/PFEIFFER", 193, "B", 3, 9],
      ["PFEIFFER", 193, "B", 3, 10],
    ],
  );
});

test("parseNorthHillsOcrText splits corrected page 194 Schnabel and Beuerman readings", () => {
  const text = `SCHNABEL/SCHNOBEL (3B, 11, s) upright, gray granite, exc cond,
scroll, leaves "PS /  Philip Schnabel / born Sept. 7, 1821, / died Dec. 17,
1921. / age 100 years / Selig sind die todten, / die in dem herrn sterben /
Rev. 14-18." CR: Philip Schnobel, Sr., d. December 19, 1921, l00y 3m 11da

SCHNABEL (3B, 13, s) upright, gray granite, exc cond, scroll, leaves
"SL / Hlerruhet in Gott / Louise Schnabel / geboren / 1, Juli 1860, /
gestorben / 14, Juli 1887. / Ich habe eihen guten kampf gekampft, /
Ich habe den lauf vollendet ich habe / Glauben gehalten hinfort ist mir /
beigelegt die krone der gerechtickeit" CRG: Louise Schnabel, f. July 17,
1887, d. 14 July, age 27y 14 d

BEUERMAN (3B, 15, s) upright, white marble, exc cond
"Marie Louise / Beuerman / Sept. 1849 / Sept. 1870" CRG: Marie Luise
Beuerman, dau. of Adolph Daniel & Charlotte, f. September 15, 1871,
d. 13 September, age 22y 4da

[BEUERMAl!f] (3B, 16, s) upright, white marble, poor cond, lamb "Franz"

[BEUERMANN] (3B, 17, s) upright, white marble, poor cond. On top: "Father"
On front: "A light Is from our/ Household gone / A voice we loved is /
Stilled / A vacant place / Around our hearth / That never can be/ Filled"

BEUERMANN (3B, 18, c) obelisk, red granite, exc cond, vase on ornate top
On front: "Beuermannn On left: "Adolph / Beuermann / born / Dec. 24, 1819,
/ died / Oct. 27, 1896" On right: "Charlotte/ Beuermann / born /
Nov. 20, 1824, / died / Jan. 25, 1905"

[BEUERMANN] (3B, 19, s) upright, white marble, poor cond. On top: "Mother''
On front: "Dearest loved one we / have laid her in the / peaceful graves
embrace / but thy memory will / be cherished till we I meet thy heavenly face."
Franklin Park Borough               194                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["SCHNABEL/SCHNOBEL", 194, "B", 3, 11],
      ["SCHNABEL", 194, "B", 3, 13],
      ["BEUERMAN", 194, "B", 3, 15],
      ["[BEUERMAl!f]", 194, "B", 3, 16],
      ["[BEUERMANN]", 194, "B", 3, 17],
      ["BEUERMANN", 194, "B", 3, 18],
      ["[BEUERMANN]", 194, "B", 3, 19],
    ],
  );
});

test("parseNorthHillsOcrText splits corrected page 195 Hieber, Schnabel, and Loeffler readings", () => {
  const text = `BRANDT (3B, 20, s) upright, gray granite, exc cond. On top·:
"Baby" On front: "Russell L. Brandt/ born/ Mar. 20, 1897 / died Jun,e 13.,
1897" Cement slab in front of stone. Could be a base. CRG: Russel Layton
Brandt b. 20 March 1897, d. 13 June 1897, buried 15 June, age 2m 23da
Plot marker: "H"

HIEBER (3B, 23, s) upright, black marble, poor cond, sunken, fallen, heart
"Esther / dau. of / D. L. & A. C. Hieber/ Nov. 15, 1898 / Dec. 16, 1905"
Note: Stone located at foot of (3B, 22)

HIEBER (3B, 24, s) upright, black marble, poor cond, sunken., fallen., heart
"Alfred/ son of / D. L. & A. C. Hieber/ May 10, 1906 / June 24 / 1909"
Note: Stone located at foot o( (3B, 22) CR: Alfred David

SCHNABEL/VOGAL (3B, 25, s) upright, gray granite, exc concl
"Carl Schnabel/ born/ March 12, 1867, /died/ Jan. 22, 1895." CRG:
Carl Schnabel, son of Philipp & wife Maria Katharina nee Vogal, b. 12 March
1867 in Allegheny Co. Pa., d. 22 January 1895 In Pittsburgh, age 27y 10m 10da,
f. January 22

SCHNABEL (3B, 26, s) upright with open ledger, gray granite, ,exc cond
"Henry Schnabel / 1856-1904"

LOEFFLER (4B, 1, s) upright, white marble, poor cond, sunken, fallen, lamb
"John E / [-] / Loeffler / [-] / [-] Aug. 1887 / [2 Illegible lines]''

LOEFFLER (4B, 2, s) upright, white marble, poor cond, sunken, fallen, lamb
"Frank J. / [-] / Loeffler/ [3 illegible lines]"

LOEFFLER (4B, 3, s) upright, gray granite, good cond, leaves, wheel
"Elizebeth/ Loeffler/ 1851-1911 /A. noble wife &./ Devoted mother / At rest''
CR: d. March 2, 1911, 59y
Franklin Park Borough               195                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["BRANDT", 195, "B", 3, 20],
      ["HIEBER", 195, "B", 3, 23],
      ["HIEBER", 195, "B", 3, 24],
      ["SCHNABEL/VOGAL", 195, "B", 3, 25],
      ["SCHNABEL", 195, "B", 3, 26],
      ["LOEFFLER", 195, "B", 4, 1],
      ["LOEFFLER", 195, "B", 4, 2],
      ["LOEFFLER", 195, "B", 4, 3],
    ],
  );
});

test("parseNorthHillsOcrText splits corrected page 196 Purucker and Will readings", () => {
  const text = `WILLS (4B, 4, s) in ground, white marble, poor cond
"Willie J. / son of / Jacob & ME Wills / died / Jan 7 1871 / aged 6 years/
[illegible lines]"
30 feet to end of row

PURUCKER (5B, 1, s) upright, white marble, poor cond, sunken, fallen
"Emma C. / daughter of / G. Purucker /[ illegible dates]" CRG: Emma
Christiane Purucker, daughter of Georg & Margarethe Catharine, f. January 24,
1875, d. 22 January, age 6y 9da

PURUCKER/PÜRÜCKER/WÖLFEL (5B, 2, s) upright, white marble, poor cond, sunken,
fallen "Catharina / gattin von / Geo. Purucker / geboren / 10 Sept. 1826 /
gest. / 10. Aug 1892" CRG: Katharina Pürücker nee Wölfel, b. 10 September
1826 In Groseneuren Bavaria, married Loh. on 5 August 1847, d. 10 August 1892,
age 65 y 11 m, f. August

PURUCKER/PURNUCKER (5B, 3, s) upright, white marble, poor cond
"Georg / Purucker / geboren / 21, Oct. 1820(?) / gest. / 20, Apr. 1898 /
[illegible lines]" CRG: Georg Purnucker, b. October 31st 1820 in Golzmühl
Oberfranken Bavaria, d. 20 April 1898 in Allegheny, buried April 23 in
Franklin T. Pa.

WILL (5B, 4, s) upright, white marble, poor cond, hand with upraised index
finger, flowers "Hier Ruht / Anna [-] / Tocter von / Jacob u. Charlotte/ Will
/ geb. d. 29 [-] 1853 / Gest. d. 20 Juli 1871 / [illegible lines]" CRG:
Anna Elisabeth Will, daughter of Jacob & Charlotte Will, f. July 22, 1871,
d. 20 July, age 18y 1m

WILL/BAUER (5B, 5, s) upright, white marble, poor cond, hand with upraised Index
finger, flowers"[-]/ Charlotte(?)/ gattin von / Jacob Will / 10 Mar. 1810 /
gestorben / 17 Jun, 18(?) / Alter 70 Jahre / [-], 7 tag/ [illegible lines]"
CRG: Charlotte Will nee Bauer in Fischbach, Rhein-Bavaria, f. June 19, 1880,
age 70y

WILL (5B, 6, s) upright, white marble, good cond, hand with upraised index
finger, flower "Jacob Will / died / Nov. 16, 1889 / aged / 77 years 1 mo /
5 days 'In labor and love allied / In death they sleep here side by side"
CRG: Jacob Will, b. October 10 in Fischbach near Kaiserslautern, Rhein-Bavaria,
d. 16 November 1889 in Allegheny, age 77y lm 6da, f. November 18

[WILL] ( 5B, 7, s) upright, white marble, good cond ''A. E. W."
Sunken area to east toward road
Franklin Park Borough               196                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["WILLS", 196, "B", 4, 4],
      ["PURUCKER", 196, "B", 5, 1],
      ["PURUCKER/PÜRÜCKER/WÖLFEL", 196, "B", 5, 2],
      ["PURUCKER/PURNUCKER", 196, "B", 5, 3],
      ["WILL", 196, "B", 5, 4],
      ["WILL/BAUER", 196, "B", 5, 5],
      ["WILL", 196, "B", 5, 6],
      ["[WILL]", 196, "B", 5, 7],
    ],
  );
  assert.equal(entries[0].rawText.includes("30 feet to end of row"), false);
  assert.equal(entries.at(-1).rawText.includes("Sunken area to east toward road"), false);
});

test("parseNorthHillsOcrText accepts corrected page 197 section B and C readings", () => {
  const text = `WILL/BRUERMANN/PFEIFFER (6B, 2, s) upright, marble, poor cond,
sunken, fallen, lamb "Amanda L. / tochter von(?) / F. & E. Will/ geboren /
24 Jan. 1883 / gestorben / 11 April 1888 / [Illegible lines]" CRG:
Amanda Luella Will, daughter of Frank & Elisabeth nee Bruermann/Pfeiffer wife
of Gottlieb Pfeiffer, f. April 11, 1888

HECK/HÖCH (6B, 3, s) upright, marble, poor cond, sunken, fallen, hand with
upraised index finger, shield "Wilhelm J. / sohn von J(?) / Heck / [-] Feb.
187(?) / [-] Jan. 187(?) / alter 1 Jahr / 10 mo. u. 21 tag /
[Illegible lines]" CRG: Wilhelm Jacob Höch, little son of Jacob & Carlina
Elisabeth, f. January 21, 1875, d. 19 January, age 1y 10m 21 [da]

SOERGEL (1C, 1, c) upright, gray granite, exc cond
"Soergel / Roy R. / 1895 - 1974 / Ruby l. / 1897 - 1994" CR: Roy Robert,
October 27, 1974, 78y11m 15da. Ruby, April 28, 1897 - July 15, 1994

SOERGEL (1C, 2, s) upright, gray granite, exc cond, flowers
"Clarence W. / son of / Roy & Ruby Soergel / 1925-1931" CR: Middle name
Wesley, d. June 25, 1925 - June 28, 1931

FLANDERS (1C, 3, s) pillow, pink granite, exc cond, flowers, leaves
"Mary (May) Flanders/ 1903-1998 / Mother" CR: Dec. 28, 1903 - Nov. 5, 1998

GILLEN (1C, 4, s) pillow, pink granite, exc cond
"Arthur l. Gillen/ 1902-1938 / Husband"

GILLEN/HEEP (1C, 5, c) pillow, gray granite, exc cond
"Gillen / James D. / 1875-1953 / Father / Emma Heep/ 1878-1971 / Mother"

SIMPSON (1C, 6, c) upright, gray granite, exc cond, airplane
"Simpson / James H. / Aug. 15, 1922 / Sept. 13, 1995" Second side Is blank.
On back: "Simpson" Separate flag holder: "US / Veteran", star CR: buried
September 16, 1995, 73y

B[-] (1C, 7, s) upright, gray granite, exc cond "F. B."
Balance of row, approximately 100 feet, is empty

McWILLIAMS (2C, 1, s) pillow, gray granite, good cond, flower
"Brother/ Henry McWilllams / 1909-1965" CR: Middle Initial T., d.
December 16, 1965, 56y 5m 25da, "our janitor"
Franklin Park Borough               197                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["WILL/BRUERMANN/PFEIFFER", 197, "B", 6, 2],
      ["HECK/HÖCH", 197, "B", 6, 3],
      ["SOERGEL", 197, "C", 1, 1],
      ["SOERGEL", 197, "C", 1, 2],
      ["FLANDERS", 197, "C", 1, 3],
      ["GILLEN", 197, "C", 1, 4],
      ["GILLEN/HEEP", 197, "C", 1, 5],
      ["SIMPSON", 197, "C", 1, 6],
      ["B[-]", 197, "C", 1, 7],
      ["McWILLIAMS", 197, "C", 2, 1],
    ],
  );
  assert.equal(entries[8].rawText.includes("Balance of row"), false);
});

test("parseNorthHillsOcrText accepts corrected page 198 section C readings", () => {
  const text = `WATENPOOL (2C, 3, s) upright, gray granite, exc cond, flower, scroll
"William A. Watenpool / 1890-1960 / Father" CR: d. December 25, 1960,
70y 11m 10da

HEIN (2C, 6, c) upright, gray granite, exc cond, flowers, leaves
"Hein / Michael J. / 1876-1954 /Father/ Mathilda K. / 1874-1956 / Mother''
On base: "Rock of Ages" In circle. On back: "Hein"

HIEBER (2C, 10, s) pillow, gray granite, exc cond, flowers, leaves
"Bertha L. Hieber / 1903-1975"

FOWLER (2C, 13, c) upright, gray granite, exc cond
"Fowler/ Chester J. / 1893-1981 / Helen E. / 1897-1973" CR: Chester,
d. May 23, 1981, 87y 5m 25da
Franklin Park Borough               198                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber]),
    [
      ["WATENPOOL", 198, "C", 2, 3],
      ["HEIN", 198, "C", 2, 6],
      ["HIEBER", 198, "C", 2, 10],
      ["FOWLER", 198, "C", 2, 13],
    ],
  );
  assert.equal(entries[0].rawText.includes("Watenpoot"), false);
  assert.equal(entries[2].rawText.includes("Hle,ber"), false);
  assert.equal(entries[3].rawText.includes("5m_25da"), false);
});

test("parseNorthHillsOcrText splits corrected page 209 section C readings", () => {
  const text = `Section C, Row 9
KEMPF/SCHOLERT(?)/KEMPT (9C, 5, c) upright, gray granite, exc cond, church
window, flowers "Kempf/ John P. / 1879-1964 / Husband / Anna /
1881-1978 / Wife" On back: "Kempf" CR: John Peter, d. June 20, 1964,
85y 4m 12da. Anna Scholert(?) Kempt, d. October 10, 1978. 97y 7m 15da

PEGHER (9C, 6, s) pillow, gray granite, good cond "Simon W. Pegher /
Pvt. Co. G. 330th Inf. / enlisted / Oct. 2, 1942 / discharged /
Feb. 13, 1943 / born Nov. 8, 1899 died Nov. 10, 1949" Separate flag
holder: "American / US / Legion", star CR: d. June 20, 1964, 85y 4m 12da

PEGHER/BRANDT (9C, 7, s) upright, gray granite, lilies "Mother/
Margaret Pegher / 1864-1920 / erected by her son Wilbert'' CR: Mrs.
Margaret Brandt Pegher, d. May 21, 1920
Plot marker "K"

LUSKEY/BERINGER (9C, 9, s) upright, gray granite, exc cond, flowers
"Emma C. Luskey / June 10, 1888 / June 2, 1955 / Wife" CR: Mrs. Emma C.
Beringer Luskey, buried June 5, 66y 11m 22da

LUSKEY (9C, 10, c) upright, gray granite, exc cond "Luskey / Edward P. /
Mar. 12, 1921 / Sept. 28, 1989 / Viola L. / Mar. 13, 1920 /
May 26, 2002." BLANCHARD (9C, 11, s) pillow, gray granite, exc cond,
cross, flowers "Marion A. Blanchard/ 1930 1980 / The Lord is my Sheperd"
[sic] CR: d. August 1, 1980, 49y 10m 25da

Section C, Row 10
KNOBELOCH/DEXTER (10C, 1 c) upright, gray granite, exc cond, grapes,
leaves "Knobeloch/ Christy C. / Mar. 15, 1908 / Sept. 27, 1979 / Father /
Grace D. / Apr. 29, 1905 / Sept. 17, 1964 / Mother" On back: "Knobeloch"
CR: Grace Dexter, Christy's wife WATTS (10C, 2, s) pillow, gray granite,
exc cond, cross, flower, leaves "Walter J. Watts / Jan. 27, 1931 /
Apr. 18, 1986"

REASEY (10C, 3, s) upright, gray granite, exc cond, angel, sad face, cross,
flowers "Our special angel / Courtney Jane / Reasey / April 12, 1985 /
Sept. 19, / 1985" On back: "Reasey"
Franklin Park Borough               209                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["KEMPF/SCHOLERT(?)/KEMPT", 209, "C", 9, 5, "couple"],
      ["PEGHER", 209, "C", 9, 6, "single"],
      ["PEGHER/BRANDT", 209, "C", 9, 7, "single"],
      ["LUSKEY/BERINGER", 209, "C", 9, 9, "single"],
      ["LUSKEY", 209, "C", 9, 10, "couple"],
      ["BLANCHARD", 209, "C", 9, 11, "single"],
      ["KNOBELOCH/DEXTER", 209, "C", 10, 1, "couple"],
      ["WATTS", 209, "C", 10, 2, "single"],
      ["REASEY", 209, "C", 10, 3, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("KEMPF /"), false);
  assert.equal(entries[2].rawText.includes("Plot marker"), false);
  assert.equal(entries[4].rawText.includes("BLANCHARD"), false);
  assert.equal(entries[6].rawText.includes("WATTS"), false);
  assert.deepEqual(entries[8].parsedYears, [1985]);
});

test("parseNorthHillsOcrText splits corrected page 210 section C readings", () => {
  const text = `Section C, Row 10
ALT (10C, 4,s) upright, gray granite, exc cond, flower, leaves
"Mother / Kate Alt / 1870-1940"
A white stone rabbit with brown stone eyes was observed on top of stone at
first reading. It was beside the stone on a second reading.

ALT (10C, 5, s) upright, gray granite, exc cond
"Father / Charles H. Alt / 1898-1956"

SCHMIDT (10C, 6, c) upright, gray granite, exc cond, 2 crosses
"Schmidt / Elmer G. / 1899-1977 / Husband / Magdeline P. / 1903-1989 /
Wife" CR: Magdeline, May 18, 2003 - Oct. 7, 1989

Section C, Row 11
WAGNER/SCHAEFER (11C, 1, c) upright, gray, granite, exc cond, flowers, leaves
"Wagner / Anthony / Sept. 17, 1891 / Sept. 22, 1989 / Helen Schaefer /
Dec. 17, 1900/Jan.28, 1992 / I said goodbye" On back: "Wagner"

CLABAUGH (11C, 2, s) flat, gray granite, exc cond, cross, flower
"Laura Louise / Clabaugh/ 1930-1989 / Daughter"

SCHAEFER (11C, 3, s) pillow, gray granite, exc cond, flowers
"Father / Charles H. Schaefer / 1874-1957"

SCHAEFER (11C, 4, s) pillow, gray granite, exc cond, flowers
"Mother / Louisa A. Schaefer / 1878-1964" Gap, about 12 feet.

KING (11C, 5, c) upright, gray granite, exc cond "King / William F. King /
1856-1931 / Elizabeth, His Wife/ 1860-1950 / Lorena, 1881- 1924 /
Coretta, 1888-1961 / Anna, 1884-1971"

WATENPOOL/BEHLER/WATTENPOOL (11C, 6, s) flat, bronze, exc cond, cross
"Hazel G. Watenpool / 1891-1923" CR: Hazel Behler Wattenpool, d. April 2,
1923, 31y 7m 27da

WATENPOOL/STEELE (11C, 7, s) pillow, gray granite, exc cond, flowers, leaves
"'Mom'/ Velma Ann/ Watenpool / Aug. 28, 1914 / July 17, 1983" CR: George
Steele's sister
Franklin Park Borough               210                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["ALT", 210, "C", 10, 4, "single"],
      ["ALT", 210, "C", 10, 5, "single"],
      ["SCHMIDT", 210, "C", 10, 6, "couple"],
      ["WAGNER/SCHAEFER", 210, "C", 11, 1, "couple"],
      ["CLABAUGH", 210, "C", 11, 2, "single"],
      ["SCHAEFER", 210, "C", 11, 3, "single"],
      ["SCHAEFER", 210, "C", 11, 4, "single"],
      ["KING", 210, "C", 11, 5, "couple"],
      ["WATENPOOL/BEHLER/WATTENPOOL", 210, "C", 11, 6, "single"],
      ["WATENPOOL/STEELE", 210, "C", 11, 7, "single"],
    ],
  );
  assert.equal(entries[3].rawText.includes("CLABAUGH"), false);
  assert.equal(entries[0].rawText.includes("l0C"), false);
  assert.equal(entries[2].rawText.includes("Magdellne"), false);
});

test("parseNorthHillsOcrText splits corrected page 211 section C readings", () => {
  const text = `Section C, Row 11
KNOBELOCH (11C, 8, c) upright, gray granite, exc cond, grapes, leaves
"William G. / 1877-1957 / Father / Emma M. / 1882-1968 / Mother"
On back: "Knobeloch" CR: William, d. December 21, 1957, 80y 1m 13da.
Emma, d. October 6, 1968

KNOBELOCH/KNOBLOCK (11C, 9, s) upright, gray granite, exc cond
"Evelyn M. / Knobeloch / 1916-1917 / Daughter" CR: Evelyn Marie
Knoblock, d. February 16, 1917, 3m, dau of Wm K.

BRANDT/BRANT (11C, 10, s) pillow, gray granite, exc cond, grapes, leaves
"Robert D. Brandt/ 1936-1969" CR: Brant, d. February 23, 1969, 32y

BRANT (11C, 11, c) upright, gray granite, exc cond, church windows
"Brant / George W. / 1868-1931 / Father / Anna C. / 1885-1968 / Mother"
CR: George, d. February 10, 1931, 62y 11m 19da. Anna, d. May 3, 1968,
82y 9m 27da

BRANT/HARTMAN (11C, 12, s) upright, gray granite, exc cond, grapes, leaves
"Charles Hartman Brant / June 19, 1911 - Sept. 23, 1981 / Beloved Son /
'I worked the land/ And now we are one'"
Plot marker, white marble, "B"

BRANDT (11C, 13, s) upright, gray granite, exc cond, vine of flowers, leaves
"Brother/ Henry G. Brandt / 1862-1921 / At rest" CR: d. July 2, 1921, 59y

BRANDT (11C, 14, s) upright, gray granite, exc cond
"George S. Brandt / 1872-1926" CR: d. October 14, 1926
Plot marker, white marble, "B"
6 inch by 6 inch white marble square marker, no inscription

HABBERT/ALT (11C, 15, s) upright, gray granite, exc cond, wild rose
"Mother / Mabel M. Alt / Habbert / July 17, 1905 / May 1, 2000"
Franklin Park Borough               211                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["KNOBELOCH", 211, "C", 11, 8, "couple"],
      ["KNOBELOCH/KNOBLOCK", 211, "C", 11, 9, "single"],
      ["BRANDT/BRANT", 211, "C", 11, 10, "single"],
      ["BRANT", 211, "C", 11, 11, "couple"],
      ["BRANT/HARTMAN", 211, "C", 11, 12, "single"],
      ["BRANDT", 211, "C", 11, 13, "single"],
      ["BRANDT", 211, "C", 11, 14, "single"],
      ["HABBERT/ALT", 211, "C", 11, 15, "single"],
    ],
  );
  assert.equal(entries[2].rawText.includes("BRANT (11C, 11"), false);
  assert.equal(entries[4].rawText.includes("BRANDT (11C, 13"), false);
  assert.equal(entries[6].rawText.includes("HABBERT/ALT"), false);
});

test("parseNorthHillsOcrText splits corrected page 212 section C readings", () => {
  const text = `Section C, Row 12
PHILLIPS ( 12C, 3, s) pillow, gray granite, exc cond, cross, flower
"Roy A. Phillips/ 1887-1965 / Father"

PHILLIPS (12C, 4, s) pillow, gray granite, exc cond, cross, flowers
"Hilda K. Phillips/ 1889-1984 / Mother"

WINSLOW/FISKE (12C, 5, s) pillow, gray granite, exc cond
"Russell Fiske/ Winslow / 1923·1923" CR: d. August 8, 1923, 2m

JOHNSTON/WINSLOW (12C, 6, s) pillow, gray granite, exc cond
"Ethel F. Winslow/ Johnston / 1902-1967"

KNOBELOCH (12C, 7, c) upright, pink granite, exc cond, flowers, leaves
"Knobeloch / Howard W. / 1914-1972 / Father / June O. / 1920-1992 /
Mother/ Together forever"
2 bronze vases in front of stone

KNOBELOCH (12C, 8, s) upright, pink granite, exc cond, flowers, leaves
"Knobeloch / Judith A. / Knobeloch / 1940-2004 / Vietnam Army" Right side
of stone is blank. Separate flag holder: "Vietnam / US/ 1964-1975", star
CR: d. March 7, 2004
About 60 feet to end of row

Section C, Row 13
TITLEY (13C, 1, s) upright, gray granite, exc cond
"Father / William E. Titley / 1867-1942"

SCHAEFER (13C, 3, s) upright, gray granite, exc cond, tulips, leaves
"Blanche S. Schaefer / May 4, 1906 / March 3, 1995" On back: "Schaefer"
Bronze vase in front of stone

CAIRNS (13C, 4, s) pillow, gray granite, exc cond
"Lewis B. Cairns / 1877-1944 / Father" CR: d. February 17, 1944

CAIRNS (13C, 5, s) pillow, gray granite, exc cond
"Catherine A. Cairns/ 1881-1940 / Mother" CR: Mrs. Lewis Cairns, d,
November 3, 1941
Franklin Park Borough               212                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["PHILLIPS", 212, "C", 12, 3, "single"],
      ["PHILLIPS", 212, "C", 12, 4, "single"],
      ["WINSLOW/FISKE", 212, "C", 12, 5, "single"],
      ["JOHNSTON/WINSLOW", 212, "C", 12, 6, "single"],
      ["KNOBELOCH", 212, "C", 12, 7, "couple"],
      ["KNOBELOCH", 212, "C", 12, 8, "single"],
      ["TITLEY", 212, "C", 13, 1, "single"],
      ["SCHAEFER", 212, "C", 13, 3, "single"],
      ["CAIRNS", 212, "C", 13, 4, "single"],
      ["CAIRNS", 212, "C", 13, 5, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("PHILLIPS (12C, 4"), false);
  assert.equal(entries[3].rawText.includes("John~ton"), false);
  assert.equal(entries[8].rawText.includes("F,ather"), false);
});

test("parseNorthHillsOcrText accepts corrected page 213 section C readings", () => {
  const text = `Section C, Row 13
CAIRNS (13C, 8, s) pillow, gray granite, exc cond "Bessie G. Cairns /
wife of / Arthur J. Cairns / 1906-1992" CR: Sept. 22, 1906 - Sept. 14,
1992

HAGUE (13C, 9, c) upright, gray granite, exc cond, vine of flower, leaves
"Hague / Arthur J. / Oct. 7, 1904 / July 24, 1976 / Father / Isabelle M. /
Sept. 26, 1908 / July 24, 1997 / Mother" On back: "Hague" CR: Arthur
Julius. Isabelle, Glenn-Kildoo Funeral Home

HAGUE (13C, 10, s) pillow, gray granite, exc cond "Isabelle R. Hague /
1926-1932 / Daughter" CR: Middle name Ruth, d. April 2, 1932, 5y 6m 9da

KNOBELOCH/KNOBLOCH (13C, 11, c) upright, gray granite, exc cond, flowers,
leaves "Knobeloch / Karl C. / 1835-1915 / Father / At rest / Clara D. /
1845-1930 / Mother / At rest" CR: Karl Charles, d. November 15, 1915.
Clara Dorthea Knobloch, d. November 23, 1930, 85y 10m 8da

EHRHARDT (13C, 12, c) upright, gray granite, exc cond, oak leaves, acorns
"J. V. Ehrhardt/ 1860-1909. / Anna M. Ehrhardt / 1867-1943. / Ehrhardt"

BRANT (13C, 14, s) upright, gray granite, exc cond, child's head, shoulders,
arms with cover in bassinette, angel on top "Baby Brant / Infant son of /
Clifford & Jacqueline / Brant / January 20, 1949" CR: Buried January 21, 1y

BRANT (13C, 16, c) upright, gray granite, exc cond, flowers, leaves "Brant/
Herbert G. / 1908-1943 / Helen S. / 1915-1998" Three loose mementos were
observed on base on both reading days: 2 kneeling children on book with
flowers, terracotta praying angel, basket of flowers. CR: Middle name
George, d. December 6, 1943
Franklin Park Borough               213                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["CAIRNS", 213, "C", 13, 8, "single"],
      ["HAGUE", 213, "C", 13, 9, "couple"],
      ["HAGUE", 213, "C", 13, 10, "single"],
      ["KNOBELOCH/KNOBLOCH", 213, "C", 13, 11, "couple"],
      ["EHRHARDT", 213, "C", 13, 12, "couple"],
      ["BRANT", 213, "C", 13, 14, "single"],
      ["BRANT", 213, "C", 13, 16, "couple"],
    ],
  );
  assert.equal(entries[0].rawText.includes("1~2"), false);
  assert.equal(entries[2].rawText.includes("Daughte~"), false);
  assert.equal(entries[3].rawText.includes("8Sy"), false);
});

test("parseNorthHillsOcrText accepts corrected page 214 section C readings", () => {
  const text = `Section C, Row 13
WALTERS/SANDROCK (13C, 17, s) upright, gray granite, exc cond, ivy, cross
"James W. / Walters / Husband / 1919-1973 / Helen S." CR: James, d.
October 8, 1973, Clara Sandrock's sister-In-law's second husband. Helen,
July 6, 1915 - June 3, 1998

STEINAUER (13C, 20, s) pillow, gray granite, exc cond "Charles / Steinauer /
1842-1904"

Section C, Row 14
BRANDT (14C, 1, c) upright, gray granite, exc cond, flower, leaves
"Brandt / Herman P. / 1877-1936 / Allie H. / 1881-1972 / 1910 Ruth Anna
1913" On back: "Brandt" CR: Herman, d. September 7, 1936. Ruth Brandt
burled Highland Presbyterian, daughter of H. P. Brandt. Note: No date on CR
but listed In 1912-1913 period

NULL (14C, 2, s) flat, bronze, exc cond, flower holder "Sara E. Null /
Sept. 7, 1ai9 - May 13, 1936"

NULL (14C, 3, s) flat, bronze, exc cond, flower holder "James W. Null /
Feb. 3, 1881 - June 2, 1959" CR: Burled June 6, 78y 4m

STEWART (14C, 4, s) upright, gray granite, exc cond, flowers "Frederick B /
Stewart / 1898-1945" CR: d. January 9, 1945

BERKSHIRE (14C, 5, s) pillow, gray granite, exc cond, flowers "Daughter /
Barbara Sue / Berkshire / 1946-1949" CR: d, December 24, 1949, 2y 11m 24da

CAPENOS (14C, 6, s) upright, pink granite, exc cond, flowers "Father /
John A. Capenos / April 5, 1910 / February 19, 1963" On back: "Capenos" CR:
52y 10m 14da, Councilman

CAPENOS/HAGUE (14C, 7, s) upright, pink granite, exc cond, flowers "Mother /
E. Pearl Capenos / July 3, 1910 / May 7, 1977" CR: Evelyn Pearl Hague
Capenos

Gap, about 30 feet.
Franklin Park Borough               214                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["WALTERS/SANDROCK", 214, "C", 13, 17, "single"],
      ["STEINAUER", 214, "C", 13, 20, "single"],
      ["BRANDT", 214, "C", 14, 1, "couple"],
      ["NULL", 214, "C", 14, 2, "single"],
      ["NULL", 214, "C", 14, 3, "single"],
      ["STEWART", 214, "C", 14, 4, "single"],
      ["BERKSHIRE", 214, "C", 14, 5, "single"],
      ["CAPENOS", 214, "C", 14, 6, "single"],
      ["CAPENOS/HAGUE", 214, "C", 14, 7, "single"],
    ],
  );
  assert.equal(entries[1].rawText.includes("\\\\"), false);
  assert.equal(entries[2].rawText.includes("Hlghland"), false);
  assert.equal(entries[8].rawText.includes("Gap, about 30 feet"), false);
});

test("parseNorthHillsOcrText splits corrected page 215 section C readings", () => {
  const text = `Section C, Row 14
CRERAR (14C, 8, s) upright, gray granite, exc cond, flowers "James Crerar /
May 6, 1905 / Jan. 19, 1954 / Father" CR: d. January 19, 1954, 48y 8m 13da

BRANT/SARVER (14C, 10, c) upright, gray granite, exc cond, flowers "Brant /
Elmer H. / 1914-1977 / Eleanor S. / 1918-1947'' CR: Elmer, d. October 18,
1977, 63y 3m 5da. Mrs. Eleanor Sarver Brant, d. January 25, 1947, 28y 2m
28da

Section C, Row 15
ROBERTSON (15C, 1, s) flat, bronze, exc cond, cross "Albert E Robertson /
US Army / World War I / July 29 1895 Jul 17 1985" Separate flag holder:
"US / Veteran", star

ROBERTSON (15C, 2, s) flat, bronze, exc cond, cross "Helen W Robertson /
Beloved wife / Sep 9 1899 Nov 10 1992"

HOERR (15C, 3, s) upright, red granite, exc cond, flowers, leaves "Daughter /
Margaret M. Hoerr / May 31, 1904 / Sept. 17, 1942"

HOERR/ BERDURG(?) (15C, 4, s) upright, red granite, exc cond, archway,
flowers, leaves "Mother/ Wilhelmine A. Hoerr / Oct. 16, 1869 / July 3,
1944" CR: Wilhelmine Berdurg(?) Hoerr

HOERR (15C, 5, s) flat, bronze, exc cond, cross "William H. Hoerr / June 18
1902 - Oct 8 1984" Separate flag holder: "US / Veteran", star

DODSON (15C, 6, s) flat, red granite, exc cond "In loving memory / Paul G.
Dodson / 1914-1992"

KOHLER (15C, 7, c) upright, red granite, exc cond, 7 foot stele., flowers,
leaves, "Kohler" On base "Edmund / 1894-1971 / Marie / 1894-1973"

GILES (15C, 8, s) pillow, red granite, exc cond 'Tornelia Giles/ 1900- 1953"
Plot marker, gray granite "W"

SCHARF (15C, 9, s) flat, bronze, exc cond, ivy "John P. Scharf / Aug. 27,
1894 / Nov. 29, 1964" CR: Middle name Peter
Franklin Park Borough               215                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["CRERAR", 215, "C", 14, 8, "single"],
      ["BRANT/SARVER", 215, "C", 14, 10, "couple"],
      ["ROBERTSON", 215, "C", 15, 1, "single"],
      ["ROBERTSON", 215, "C", 15, 2, "single"],
      ["HOERR", 215, "C", 15, 3, "single"],
      ["HOERR/ BERDURG(?)", 215, "C", 15, 4, "single"],
      ["HOERR", 215, "C", 15, 5, "single"],
      ["DODSON", 215, "C", 15, 6, "single"],
      ["KOHLER", 215, "C", 15, 7, "couple"],
      ["GILES", 215, "C", 15, 8, "single"],
      ["SCHARF", 215, "C", 15, 9, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("48y Bm"), false);
  assert.equal(entries[1].rawText.includes("BRANT/ SARVER"), false);
  assert.equal(entries[8].rawText.includes("GILES"), false);
  assert.equal(entries[9].rawText.includes("SCHARF"), false);
});

test("parseNorthHillsOcrText accepts corrected page 216 section C readings", () => {
  const text = `Section C, Row 15
MCKEE/SCHARF (15C, 10, s) upright, gray granite, exc cond, flower, leaves
"Margaret Scharf / McKee/ 1884-1953" CR: Anna Margaret, d, February 11,
1953, 68y 4m 15da

GRAU/SCHARF (15C, 11, s) upright, gray granite, exc cond, flower, leaves
"Christina E. Grau / nee Scharf / 1887-1938" CR: Christine, d. December
28, 1938

HAYS (15C, 12, s) pillow, gray granite, exc cond, jonquil, leaves "Father /
Henry R. Hays / 1898-1953"

PROIE (15C, 14, c) pillow, gray granite, exc cond, lilies, leaves, eternal
flame holder "Proie / James A., Jr. / Nov. 17, 1931 / April 9, 2006 /
Evelyn C. / April 25, 1932 / April 8, 2000" CR: James, d. April 9, 2006,
f. April 12, 2006

ULLOM (15C, 16, s) pillow, gray granite, exc cond "Rufus K. Ullom / Sgt Co D
111th Inf / enlisted / June 22, 1916 / born Mar. 4, 1877 / discharged /
May 14, 1919 / died Sept. 29, 1942" Separate flag holder: "US / Veteran",
star CR: buried October 1, 1942, 78y

UHLENBURG (15C, 17, s) upright, gray granite, exc cond, flower "Husband /
Elmer E. Uhlenburg / 1869-1942"

UHLENBURG/ULEMBERG (15C, 18, s) upright, gray granite, exc cond, flower
"Wife / Christine Uhlenburg / 1873-1955" CR: Christina F Ulemberg., d.
October 14, 1955. Funeral conducted by Rev. Martin, member of Salem
Methodist

HIEBER (15C, 19, c) upright, gray granite, exc cond, flowers, leaves "Hieber
/ Albert D. / 1872-1947 / Ida C. / 1872-[blank] / Wife"

SANDROCK (15C, 20, c) flat, bronze, exc cond, roses, leaves, Masonic '
insignia "Adam / 1900 - [blank] / Clara B. / 1906-1978 / Sandrock" Bronze
vase. CR: Adam, d. January 30, 1983. Clara E., d. November 3, 1978, 72y
8m 7da
Franklin Park Borough               216                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["MCKEE/SCHARF", 216, "C", 15, 10, "single"],
      ["GRAU/SCHARF", 216, "C", 15, 11, "single"],
      ["HAYS", 216, "C", 15, 12, "single"],
      ["PROIE", 216, "C", 15, 14, "couple"],
      ["ULLOM", 216, "C", 15, 16, "single"],
      ["UHLENBURG", 216, "C", 15, 17, "single"],
      ["UHLENBURG/ULEMBERG", 216, "C", 15, 18, "single"],
      ["HIEBER", 216, "C", 15, 19, "couple"],
      ["SANDROCK", 216, "C", 15, 20, "couple"],
    ],
  );
  assert.equal(entries[1].rawText.includes("Plot marker"), false);
  assert.equal(entries[5].rawText.includes("UHLENBURG/ULEMBERG"), false);
  assert.equal(entries[6].rawText.includes("HIEBER"), false);
});

test("parseNorthHillsOcrText accepts corrected page 217 section C readings", () => {
  const text = `Section C, Row 15
BRANDT (15c, 21, c) upright, gray granite, exc cond "Brandt / H. Carl /
1912 -1997 / Alice R. / 1911-1991" On back: "Brandt"

Section C, Row 16
DeCOURCY/DeWITT/HAMILTON (16C, 1, c) upright, gray granite, exc cond,
flower, leaves "DeCourcy / William / DeWitt / 1921 - [blank) / Louise /
Hamilton / 1925-1990" On base: small stone memento with stars "Perhaps
they are not/  stars in the sky, / but rather openings / where our loved
ones / shine down / to let us know they are happy" On back: "DeCourcy"

DeCOURCY/HAMILTON/DeCOURCEY (16C, 2, s) upright, gray granite, exc cond
"William Hamilton/ DeCourcy / Nov. 4, 1957" CR: Son o,f William Decourcey,
d. December 2, 1957

WATENPOOL (16C, 3, s) upright, gray granite, exc cond, flower, leaves "Allan
J. / Watenpool / 1911-1944" CR: Middle name Joseph, d. December 9, 1944

BLACKFORD/WATENPOOL (16C, 4, s) upright, gray granite, exc cond, flowers,
leaves "Margaret/ Watenpool / Blackford/ 1909 - 2004"

BLACKFORD (16C, 5, s) upright, gray granite, exc cond, flowers, leaves
"Byron H. / Blackford / 1902-1983" CR: d. November 28, 1983, 81y 1m 5da
Plot marker, stone "W"

BUCHHOLZ (16C, 6, s) upright, gray granite, exc cond, ivy "Aunt / Carrie
Buchholz / 1898-1981" Bronze urn in ground CR: Caroline Louise, d.
November 11, 1981, 83y 3m 9da

BUCHHOLZ/CLEESE/BUCKHOLZ (16C, 7, s) upright, gray granite, exc cond, ivy
"Mother / Nettie Buchholz / 1861-1960" Bronze urn in ground CR: Nettie
(Cleese) Buckholz, d. June 6, 1960, 90 y 20 da, born in Germany
Franklin Park Borough               217                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["BRANDT", 217, "C", 15, 21, "couple"],
      ["DeCOURCY/DeWITT/HAMILTON", 217, "C", 16, 1, "couple"],
      ["DeCOURCY/HAMILTON/DeCOURCEY", 217, "C", 16, 2, "single"],
      ["WATENPOOL", 217, "C", 16, 3, "single"],
      ["BLACKFORD/WATENPOOL", 217, "C", 16, 4, "single"],
      ["BLACKFORD", 217, "C", 16, 5, "single"],
      ["BUCHHOLZ", 217, "C", 16, 6, "single"],
      ["BUCHHOLZ/CLEESE/BUCKHOLZ", 217, "C", 16, 7, "single"],
    ],
  );
  assert.equal(entries[3].rawText.includes(";: ."), false);
  assert.equal(entries[5].rawText.includes("Plot marker"), true);
});

test("parseNorthHillsOcrText splits corrected page 218 section C readings", () => {
  const text = `Section C, Row 16
BRUECKMAN (16C, 9, s) flat, bronze, exc cond, cross "William W. Brueckman /
Sgt Army Air Forces / Aug 5 1924  May 31 1974" RANKER/BRUECKMAN (16C, 10,
s) flat, bronze, exc cond, cross "Carol Brueckman/ Ranker / Loving wife and
mother / Jul 17 1929 - May 22, 1999"

KAELIN (16C, 11, c) upright, gray granite, exc cond, flower, leaves "Kaelin /
Elmer B. / May 4, 1900 / July 11, 1958 / Father  Elizabeth A. / June 22,
1896 / Feb. 27, 1974 / Mother" On back: "Kaelin"

LEIDECKER (16C, 12, s) flat, green metal, exc cond, open Bible "George Henry
Leidecker / 1877-1943" CR: d. July 2, 1943

LEIDECKER/SHENOT (16C, 13, s) flat, green metal, exc cond, open Bible "Emma
Shenot Leidecker / 1876-1955" CR: Emma E., d. January 6, 1955, 77y 4m 5da

WOCHLEY/LEIDECKER (16C, 14, c) upright, gray granite, exc cond, ivy "Wochley
/ Arthur / Dennis/ Feb. 8, 1903 / Mar. 21, 1984 / Lucell / Leidecker / Jan.
3, 1907 / June 28, 1965 / Lo, I am with your always" On back: "Wochley"

WOLFARTH (16C, 15, s) flat, gray granite, exc cond, cross ''Raymond A.
Woifarth / Tec 5 US Army / World War II / Jan 24 1921 - Jul 4 1990" Separate
flag holder: "US / Veteran", star

DENT (16C, 16, s) upright, gray granite, exc cond "Andrew J. Dent / 1866-1947
/ Father" CR: Middle name James, d. January 19, 1947, 80y 11m 26da

LUSTER (16C, 18, s) upright, orange granite, good cond, airplane, flowers,
leaves "Luster / George Wm. Jr. / 1937-1957" CR: d. November 1, 1957, 20y 7m
20da, son of Mary Section C, Row 17 Row begins about 30 feet from the road
Franklin Park Borough               218                Allegheny County, PA`;

  const entries = parseNorthHillsOcrText(text);

  assert.deepEqual(
    entries.map((entry) => [entry.nameText, entry.sourcePageNumber, entry.parsedSectionName, entry.parsedRowNumber, entry.parsedPositionNumber, entry.parsedMarkerScope]),
    [
      ["BRUECKMAN", 218, "C", 16, 9, "single"],
      ["RANKER/BRUECKMAN", 218, "C", 16, 10, "single"],
      ["KAELIN", 218, "C", 16, 11, "couple"],
      ["LEIDECKER", 218, "C", 16, 12, "single"],
      ["LEIDECKER/SHENOT", 218, "C", 16, 13, "single"],
      ["WOCHLEY/LEIDECKER", 218, "C", 16, 14, "couple"],
      ["WOLFARTH", 218, "C", 16, 15, "single"],
      ["DENT", 218, "C", 16, 16, "single"],
      ["LUSTER", 218, "C", 16, 18, "single"],
    ],
  );
  assert.equal(entries[0].rawText.includes("RANKER/BRUECKMAN"), false);
  assert.equal(entries[8].rawText.includes("Row begins"), false);
});
