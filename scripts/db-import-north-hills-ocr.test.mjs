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
WILLS (3C, 12, s) pillow, gray granite, exc cond, grapes, leaves, church window "John H. Wills/ 1875-1956 / Brother" CR: Middle name Henry, d. June 29, 1956, Sly 4m 17da 'WILLS (3C, 13, s) pillow, gray granite, exc cond, grapes, leaves, church window "Frank E. Wills/ 1880-1927 / Brother" CR: d. December 18, 1927 WILLS/BROERMAN/WILL (JC, 14, c) upright, gray granite, exc cond, ornate scrollwork at top with "W" "WIiis / Frank Wills/ 1843- ..1926 / Elizabeth Wills/ 1849-1920" Separate flag holder: "GAR/ 1861 / 1865" CR: Frank, Sr., d. May 28, 1926. Elizabeth Broerman Will, d. April 19, 1920
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
  assert.equal(entries[0].rawText.endsWith("Sly 4m 17da"), true);
  assert.equal(entries[1].rawText.startsWith("WILLS (3C, 13, s)"), true);
  assert.deepEqual(entries[0].parsedYears, [1875, 1956]);
  assert.deepEqual(entries[1].parsedYears, [1880, 1927]);
  assert.deepEqual(entries[2].parsedYears, [1843, 1849, 1861, 1865, 1920, 1926]);
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
