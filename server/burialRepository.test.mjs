import assert from "node:assert/strict";
import test from "node:test";

import { splitRecordedDate } from "./burialRepository.mjs";

test("splitRecordedDate keeps exact dates available for date columns", () => {
  assert.deepEqual(splitRecordedDate("1901-03-23"), { date: "1901-03-23", text: "1901-03-23" });
});

test("splitRecordedDate parses month day year text without discarding source text", () => {
  assert.deepEqual(splitRecordedDate("March 23, 1901"), { date: "1901-03-23", text: "March 23, 1901" });
  assert.deepEqual(splitRecordedDate("Nov. 1929"), { date: null, text: "Nov. 1929" });
});

test("splitRecordedDate stores partial or malformed dates as text only", () => {
  assert.deepEqual(splitRecordedDate("1929"), { date: null, text: "1929" });
  assert.deepEqual(splitRecordedDate("March23, 1901"), { date: null, text: "March23, 1901" });
  assert.deepEqual(splitRecordedDate(""), { date: null, text: null });
});
