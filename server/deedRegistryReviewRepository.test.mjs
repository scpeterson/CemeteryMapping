import assert from "node:assert/strict";
import test from "node:test";
import { listDeedRegistryReview } from "./deedRegistryReviewRepository.mjs";

test("listDeedRegistryReview returns batches, summaries, evidence rows, and related investigation notes", async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("FROM deed_registry_import_batches batch")) {
        return {
          rows: [
            {
              id: "batch-1",
              cemetery_name: "Trinity Lutheran Church Cemetery",
              source_name: "Trinity Cemetery Registry 2022 - Updated 2022 final importer",
              worksheet_name: "Updated 2022",
              imported_by: "Scott Peterson",
              notes: "Final importer",
              created_at: "2026-05-27T12:46:57.728Z",
              entry_count: "258",
              review_count: "3",
              low_confidence_count: "46",
            },
          ],
        };
      }
      if (sql.includes("GROUP BY entry.ownership_scope")) {
        assert.deepEqual(values, ["batch-1"]);
        return {
          rows: [
            { ownership_scope: "section_g_gravesite", parse_confidence: "high", count: "18" },
            { ownership_scope: "unknown", parse_confidence: "review", count: "3" },
          ],
        };
      }
      if (sql.includes("related_investigation_notes")) {
        assert.deepEqual(values, ["batch-1", "review", "%watenpool%", 50]);
        return {
          rows: [
            {
              id: "entry-1",
              batch_id: "batch-1",
              source_row_number: 236,
              row_type: "owner_record",
              owner_display_name: "Robert & Elizabeth Watenpool",
              raw_lot_text: "88",
              raw_section_text: "",
              raw_remarks: "Updated to show plot 88 based on investigation.",
              deed_on_file: "No",
              deed_register_on_file: "No",
              parsed_section_name: null,
              parsed_section_alias: null,
              parsed_lot_numbers: ["88"],
              parsed_plot_numbers: [],
              parsed_grave_numbers: [],
              parsed_grave_count: null,
              ownership_scope: "whole_lot",
              parse_confidence: "review",
              parse_notes: ["Needs review."],
              status: "staged",
              allocation_count: "1",
              related_investigation_notes: [{ sourceRowNumber: 16, ownerDisplayName: "Robert & Elizabeth Watenpool", rawRemarks: "Blackford investigation note." }],
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const review = await listDeedRegistryReview(pool, { confidence: "review", q: "Watenpool", limit: 50 });

  assert.equal(review.selectedBatchId, "batch-1");
  assert.equal(review.batches[0].entryCount, 258);
  assert.deepEqual(review.summary[0], { ownershipScope: "section_g_gravesite", parseConfidence: "high", count: 18 });
  assert.equal(review.entries[0].ownerDisplayName, "Robert & Elizabeth Watenpool");
  assert.equal(review.entries[0].allocationCount, 1);
  assert.equal(review.entries[0].relatedInvestigationNotes[0].sourceRowNumber, 16);
  assert.equal(calls.length, 3);
});
