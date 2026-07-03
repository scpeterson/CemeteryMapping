import assert from "node:assert/strict";
import test from "node:test";
import { deleteNorthHillsOcrEvidenceLink, listNorthHillsOcrReview, saveNorthHillsOcrEvidenceLink, updateNorthHillsOcrEntry } from "./northHillsOcrReviewRepository.mjs";

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

      assert.match(sql, /CASE entry\.parse_confidence/u);
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
            candidate_match_count: "2",
            candidate_matches: [
              { burialId: "burial-1", gravesiteId: "TLC-GPS-0009", sectionId: "A", fullName: "George L Burgess", score: 9 },
              { burialId: "burial-2", gravesiteId: "TLC-GPS-0448", sectionId: "D", fullName: '"" Frederick Miller', score: 5 },
            ],
            source_facts: [{ id: "fact-1", sourceCode: "CR", factType: "death_date", factValue: "December 16, 1965", status: "staged" }],
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
  assert.equal(review.entries[0].candidateMatches[1].fullName, "Frederick Miller");
  assert.equal(review.entries[0].sourceFacts[0].factValue, "December 16, 1965");
});

test("listNorthHillsOcrReview can sort staged readings by printed page order", async () => {
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
        return { rows: [] };
      }

      assert.doesNotMatch(sql, /CASE entry\.parse_confidence/u);
      assert.match(sql, /ORDER BY\s+[\s\S]*entry\.source_page_number NULLS LAST,\s+entry\.source_page_index,\s+entry\.source_line_start/u);
      assert.deepEqual(values, ["batch-1", 100]);
      return { rows: [] };
    },
  };

  await listNorthHillsOcrReview(pool, { sort: "page" });
});

test("listNorthHillsOcrReview search matches printed page numbers", async () => {
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
        return { rows: [] };
      }

      assert.match(sql, /WHERE entry\.batch_id = \$1\s+AND entry\.source_page_number = \$2/u);
      assert.doesNotMatch(sql, /lower\(coalesce\(entry\.raw_text/u);
      assert.doesNotMatch(sql, /CASE entry\.parse_confidence/u);
      assert.match(sql, /ORDER BY\s+[\s\S]*entry\.source_page_number NULLS LAST,\s+entry\.source_page_index,\s+entry\.source_line_start/u);
      assert.deepEqual(values, ["batch-1", 183, 100]);
      return { rows: [] };
    },
  };

  await listNorthHillsOcrReview(pool, { q: "183" });
});

test("saveNorthHillsOcrEvidenceLink stores reviewed gravesite evidence with audit context", async () => {
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("RETURNING")) {
            return {
              rows: [
                {
                  id: "link-1",
                  entry_id: "11111111-1111-4111-8111-111111111111",
                  target_type: "gravesite",
                  target_id: "22222222-2222-4222-8222-222222222222",
                  status: "linked",
                  confidence: "high",
                  notes: "Looks right",
                  reviewed_by_email: "admin@example.test",
                  reviewed_at: "2026-05-29T12:00:00.000Z",
                },
              ],
            };
          }

          return { rows: [] };
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const link = await saveNorthHillsOcrEvidenceLink(
    pool,
    "11111111-1111-4111-8111-111111111111",
    {
      targetType: "gravesite",
      targetId: "22222222-2222-4222-8222-222222222222",
      status: "linked",
      confidence: "high",
      notes: "Looks right",
    },
    {
      actorUser: {
        id: "33333333-3333-4333-8333-333333333333",
        subject: "auth0|admin",
        email: "admin@example.test",
        role: "admin",
      },
    },
  );

  assert.deepEqual(link, {
    id: "link-1",
    entryId: "11111111-1111-4111-8111-111111111111",
    targetType: "gravesite",
    targetId: "22222222-2222-4222-8222-222222222222",
    status: "linked",
    confidence: "high",
    notes: "Looks right",
    reviewedByEmail: "admin@example.test",
    reviewedAt: "2026-05-29T12:00:00.000Z",
  });
  assert.equal(queries[0].sql, "BEGIN");
  assert.equal(queries.at(-2).sql, "COMMIT");
  assert.equal(queries.at(-1).sql, "RELEASE");
  assert.match(queries.find((query) => query.sql.includes("RETURNING"))?.sql ?? "", /north_hills_ocr_entry_gravesite_links/u);
  assert.deepEqual(queries.find((query) => query.sql.includes("RETURNING"))?.values, [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "linked",
    "high",
    "Looks right",
    "33333333-3333-4333-8333-333333333333",
    "auth0|admin",
    "admin@example.test",
  ]);
});

test("deleteNorthHillsOcrEvidenceLink removes reviewed headstone evidence with audit context", async () => {
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("DELETE FROM north_hills_ocr_entry_headstone_links")) {
            return {
              rows: [
                {
                  id: "link-1",
                  entry_id: "11111111-1111-4111-8111-111111111111",
                  target_type: "headstone",
                  target_id: "22222222-2222-4222-8222-222222222222",
                  status: "linked",
                  confidence: "high",
                  notes: "Mistaken link",
                  reviewed_by_email: "admin@example.test",
                  reviewed_at: "2026-05-29T12:00:00.000Z",
                },
              ],
            };
          }

          return { rows: [] };
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const link = await deleteNorthHillsOcrEvidenceLink(
    pool,
    "11111111-1111-4111-8111-111111111111",
    {
      targetType: "headstone",
      targetId: "22222222-2222-4222-8222-222222222222",
    },
    {
      actorUser: {
        id: "33333333-3333-4333-8333-333333333333",
        subject: "auth0|admin",
        email: "admin@example.test",
        role: "cemetery-admin",
      },
    },
  );

  assert.equal(link?.targetType, "headstone");
  assert.equal(queries[0].sql, "BEGIN");
  assert.equal(queries.at(-2).sql, "COMMIT");
  assert.equal(queries.at(-1).sql, "RELEASE");
  assert.match(queries.find((query) => query.sql.includes("DELETE FROM"))?.sql ?? "", /north_hills_ocr_entry_headstone_links/u);
  assert.deepEqual(queries.find((query) => query.sql.includes("DELETE FROM"))?.values, [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ]);
});

test("updateNorthHillsOcrEntry saves entry fields, source facts, and typed observations together", async () => {
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("SELECT id, cemetery_id")) {
            return {
              rows: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  cemetery_id: "22222222-2222-4222-8222-222222222222",
                },
              ],
            };
          }
          if (sql.includes("UPDATE north_hills_ocr_entries")) return { rows: [{ id: "11111111-1111-4111-8111-111111111111" }] };
          if (sql.includes("FROM north_hills_ocr_entries entry") && sql.includes("COALESCE(observations.observations")) {
            return {
              rows: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  batch_id: "33333333-3333-4333-8333-333333333333",
                  source_page_number: 220,
                  source_page_index: 41,
                  source_line_start: 10,
                  source_line_end: 12,
                  name_text: "STETTLER",
                  surnames: ["STETTLER"],
                  raw_text: "STETTLER corrected",
                  parsed_section_name: "C",
                  parsed_row_number: 17,
                  parsed_position_number: 14,
                  parsed_marker_scope: "single",
                  marker_type_text: "upright",
                  material_text: "granite",
                  condition_text: "excellent",
                  inscription_text: "George T. Stettler",
                  parsed_years: [1896, 1951],
                  parse_confidence: "high",
                  parse_notes: [],
                  status: "reviewed",
                  candidate_match_count: "0",
                  candidate_matches: [],
                  source_facts: [],
                  observations: [
                    {
                      id: "44444444-4444-4444-8444-444444444444",
                      entryId: "11111111-1111-4111-8111-111111111111",
                      observationType: "plot_marker",
                      observationText: "Plot marker H nearby",
                      status: "staged",
                    },
                    {
                      id: "55555555-5555-4555-8555-555555555555",
                      entryId: "11111111-1111-4111-8111-111111111111",
                      observationType: "gap",
                      observationText: "About 30 feet to end of row",
                      status: "staged",
                    },
                  ],
                },
              ],
            };
          }

          return { rows: [] };
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const updated = await updateNorthHillsOcrEntry(
    pool,
    "11111111-1111-4111-8111-111111111111",
    {
      sourcePageNumber: 220,
      sourceLineStart: 10,
      sourceLineEnd: 12,
      rawText: "STETTLER corrected",
      nameText: "STETTLER",
      surnames: ["STETTLER"],
      parsedSectionName: "C",
      parsedRowNumber: 17,
      parsedPositionNumber: 14,
      parsedMarkerScope: "single",
      markerTypeText: "upright",
      materialText: "granite",
      conditionText: "excellent",
      inscriptionText: "George T. Stettler",
      parsedYears: [1951, 1896],
      parseConfidence: "high",
      parseNotes: [],
      status: "reviewed",
      sourceEntry: { heading: "STETTLER" },
      sourceFacts: [
        {
          sourceCode: "CR",
          factType: "death_date",
          factValue: "October 7, 1951",
          factDate: "1951-10-07",
          rawText: "CR: d. October 7, 1951",
          confidence: "high",
          status: "staged",
        },
      ],
      observations: [
        { observationType: "plot_marker", observationText: "Plot marker H nearby", status: "staged" },
        { observationType: "gap", observationText: "About 30 feet to end of row", status: "staged" },
      ],
    },
    {
      actorUser: {
        id: "66666666-6666-4666-8666-666666666666",
        subject: "auth0|admin",
        email: "admin@example.test",
        role: "cemetery-admin",
      },
      allowedCemeteryIds: ["22222222-2222-4222-8222-222222222222"],
    },
  );

  assert.equal(updated?.nameText, "STETTLER");
  assert.deepEqual(updated?.observations.map((observation) => observation.observationType), ["plot_marker", "gap"]);
  assert.equal(queries[0].sql, "BEGIN");
  assert.equal(queries.at(-2).sql, "COMMIT");
  assert.equal(queries.at(-1).sql, "RELEASE");
  assert.match(queries.find((query) => query.sql.includes("INSERT INTO north_hills_ocr_source_facts"))?.sql ?? "", /ON CONFLICT/u);
  const observationInserts = queries.filter((query) => query.sql.includes("INSERT INTO north_hills_ocr_entry_observations"));
  assert.equal(observationInserts.length, 2);
  assert.deepEqual(
    observationInserts.map((query) => query.values.slice(1, 4)),
    [
      ["plot_marker", "Plot marker H nearby", "staged"],
      ["gap", "About 30 feet to end of row", "staged"],
    ],
  );
});
