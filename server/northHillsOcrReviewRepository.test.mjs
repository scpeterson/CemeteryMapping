import assert from "node:assert/strict";
import test from "node:test";
import { listNorthHillsOcrReview } from "./northHillsOcrReviewRepository.mjs";

test("listNorthHillsOcrReview returns batches, summaries, staged readings, and candidate matches", async () => {
  const pool = {
    async query(sql, values) {
      if (sql.includes("FROM north_hills_ocr_import_batches batch")) {
        return {
          rows: [
            {
              id: "batch-1",
              cemetery_name: "Trinity Lutheran Church Cemetery",
              source_name: "North Hills Genealogists Trinity OCR",
              imported_by: "Scott Peterson",
              notes: "Searchable PDF",
              created_at: "2026-05-29T16:40:36.000Z",
              entry_count: "2",
              review_count: "0",
              low_confidence_count: "0",
              matched_count: "2",
            },
          ],
        };
      }

      if (sql.includes("SELECT entry.parse_confidence, entry.status")) {
        assert.deepEqual(values, ["batch-1"]);
        return { rows: [{ parse_confidence: "high", status: "staged", count: "2" }] };
      }

      assert.deepEqual(values, ["batch-1", "high", "A", "%burgess%", 50]);
      return {
        rows: [
          {
            id: "entry-1",
            batch_id: "batch-1",
            source_page_number: 183,
            source_page_index: 4,
            source_line_start: 6,
            source_line_end: 7,
            name_text: "BURGESS",
            surnames: ["BURGESS"],
            raw_text: "BURGESS ... George L. / 1876-1942 /Father",
            parsed_section_name: "A",
            parsed_row_number: 1,
            parsed_position_number: 1,
            parsed_marker_scope: "single",
            marker_type_text: "pillow",
            material_text: "granite",
            condition_text: "excellent",
            inscription_text: "George L. / 1876-1942 /Father",
            parsed_years: [1876, 1942],
            parse_confidence: "high",
            parse_notes: [],
            status: "staged",
            candidate_match_count: "1",
            candidate_matches: [{ burialId: "burial-1", gravesiteId: "TLC-GPS-0009", sectionId: "A", fullName: "George L Burgess", score: 9 }],
          },
        ],
      };
    },
  };

  const review = await listNorthHillsOcrReview(pool, { confidence: "high", section: "a", q: "Burgess", limit: 50 });

  assert.equal(review.selectedBatchId, "batch-1");
  assert.equal(review.batches[0].matchedCount, 2);
  assert.deepEqual(review.summary[0], { parseConfidence: "high", status: "staged", count: 2 });
  assert.equal(review.entries[0].candidateMatches[0].gravesiteId, "TLC-GPS-0009");
});
