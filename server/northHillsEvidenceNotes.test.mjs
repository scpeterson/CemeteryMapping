import assert from "node:assert/strict";
import test from "node:test";
import { toNorthHillsEvidence } from "./cemeteryMappers.mjs";
import { selectHeadstoneById } from "./cemeteryHeadstoneQueries.mjs";

test("gravesite NHG evidence preserves reading notes separately from link review notes", () => {
  const note = "No stone with this inscription was found on second reading, only a flat spot in the earth.";
  const mapped = toNorthHillsEvidence({ raw_text: "EADIE (9C, 4, s)", parse_notes: [note], review_notes: "Confirmed link" });
  assert.deepEqual(mapped.readingNotes, [note]);
  assert.equal(mapped.reviewNotes, "Confirmed link");
  assert.deepEqual(toNorthHillsEvidence({}).readingNotes, []);
});

test("monument NHG evidence query includes reading notes", async () => {
  let sql = "";
  await selectHeadstoneById({ async query(text) { sql = text; return { rows: [] }; } }, "marker-1");
  assert.match(sql, /'readingNotes', COALESCE\(entry.parse_notes/u);
});
