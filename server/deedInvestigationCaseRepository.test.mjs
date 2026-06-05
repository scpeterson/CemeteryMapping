import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeedInvestigationCase,
  createDeedInvestigationCaseAction,
  linkDeedInvestigationCaseEntry,
  listDeedInvestigationCases,
  updateDeedInvestigationCaseAction,
} from "./deedInvestigationCaseRepository.mjs";

const caseRow = {
  id: "case-1",
  cemetery_id: "cemetery-1",
  cemetery_name: "Trinity Lutheran Church Cemetery",
  case_number: "DI-20260317",
  status: "awaiting_council",
  subject_name: "Elaine Krepps Wasko",
  requester_name: "Barb Porti",
  requester_contact: "barbporti@gmail.com",
  plot_reference: "61 OC",
  request_summary: "Research last remaining gravesite for Mildred Krepps daughter.",
  family_summary: "Mildred children include Elaine, Marion, and Kenneth.",
  findings: "No original deed located.",
  council_decision: "Recommend replacement deed after lost deed affidavit.",
  affidavit_status: "sent",
  outcome: "",
  opened_at: "2026-03-17",
  closed_at: null,
  created_at: "2026-03-17T12:00:00.000Z",
  updated_at: "2026-03-17T12:00:00.000Z",
  linked_entry_count: "1",
  linked_entries: [
    {
      id: "entry-1",
      sourceRowNumber: 61,
      ownerDisplayName: "James & Margaret Sarver",
      rawLotText: "61",
      rawSectionText: "OC",
      rawRemarks: "Krepps investigation note.",
      note: "Likely source plot.",
    },
  ],
  recommended_actions: [
    {
      id: "action-1",
      caseId: "case-1",
      subjectName: "Elaine Krepps Wasko",
      actionType: "replacement_deed",
      plotReference: "61 OC grave 4",
      councilStatus: "recommended",
      councilDecisionDate: "",
      councilDocumentReference: "",
      affidavitStatus: "sent",
      deedStatus: "pending",
      outcome: "",
      notes: "Issue no-charge deed after lost deed affidavit.",
      sortOrder: 100,
      createdAt: "2026-03-17T12:00:00.000Z",
      updatedAt: "2026-03-17T12:00:00.000Z",
    },
  ],
};

test("listDeedInvestigationCases filters cases and maps linked evidence counts", async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      assert.match(sql, /FROM deed_investigation_cases investigation/u);
      assert.deepEqual(values, ["awaiting_council", "%krepps%", 25]);
      return { rows: [{ ...caseRow, linked_entries: [] }] };
    },
  };

  const cases = await listDeedInvestigationCases(pool, { status: "awaiting_council", q: "Krepps", limit: 25 });

  assert.equal(cases[0].caseNumber, "DI-20260317");
  assert.equal(cases[0].subjectName, "Elaine Krepps Wasko");
  assert.equal(cases[0].linkedEntryCount, 1);
  assert.equal(cases[0].recommendedActions[0].actionType, "replacement_deed");
  assert.equal(calls.length, 1);
});

test("createDeedInvestigationCase writes audited case fields", async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("set_config")) return { rows: [] };
      if (sql.includes("INSERT INTO deed_investigation_cases")) {
        assert.equal(values[1], "DI-20260317");
        assert.equal(values[3], "Elaine Krepps Wasko");
        assert.equal(values[7], "Research last remaining gravesite.");
        return { rows: [{ id: "case-1" }] };
      }
      if (sql.includes("WHERE investigation.id = $1")) return { rows: [caseRow] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {
      calls.push({ sql: "release" });
    },
  };
  const pool = { async connect() { return client; } };

  const saved = await createDeedInvestigationCase(
    pool,
    {
      caseNumber: "DI-20260317",
      status: "awaiting_council",
      subjectName: "Elaine Krepps Wasko",
      requesterName: "Barb Porti",
      plotReference: "61 OC",
      requestSummary: "Research last remaining gravesite.",
      affidavitStatus: "sent",
      openedAt: "2026-03-17",
    },
    { reason: "Document deed investigation." },
  );

  assert.equal(saved.linkedEntries[0].sourceRowNumber, 61);
  assert.equal(calls.at(-1).sql, "release");
});

test("linkDeedInvestigationCaseEntry upserts linked evidence", async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("set_config")) return { rows: [] };
      if (sql.includes("INSERT INTO deed_investigation_case_entries")) {
        assert.deepEqual(values, ["case-1", "entry-1", "Likely source plot."]);
        return { rows: [] };
      }
      if (sql.includes("WHERE investigation.id = $1")) return { rows: [caseRow] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {
      calls.push({ sql: "release" });
    },
  };
  const pool = { async connect() { return client; } };

  const saved = await linkDeedInvestigationCaseEntry(pool, "case-1", "entry-1", "Likely source plot.");

  assert.equal(saved.caseNumber, "DI-20260317");
  assert.equal(saved.linkedEntryCount, 1);
  assert.equal(calls.at(-1).sql, "release");
});

test("createDeedInvestigationCaseAction stores one recommended action", async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("set_config")) return { rows: [] };
      if (sql.includes("INSERT INTO deed_investigation_case_actions")) {
        assert.deepEqual(values, [
          "case-1",
          "Jim English",
          "inter_ashes",
          "61 OC James and Margaret Sarver graves",
          "recommended",
          "2026-03-17",
          "Council minutes 2026-03-17",
          "needed",
          "pending",
          null,
          "Ashes over grandparents.",
          200,
        ]);
        return {
          rows: [
            {
              id: "action-2",
              case_id: "case-1",
              subject_name: "Jim English",
              action_type: "inter_ashes",
              plot_reference: "61 OC James and Margaret Sarver graves",
              council_status: "recommended",
              council_decision_date: "2026-03-17",
              council_document_reference: "Council minutes 2026-03-17",
              affidavit_status: "needed",
              deed_status: "pending",
              outcome: null,
              notes: "Ashes over grandparents.",
              sort_order: 200,
              created_at: "2026-03-17T12:00:00.000Z",
              updated_at: "2026-03-17T12:00:00.000Z",
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {
      calls.push({ sql: "release" });
    },
  };
  const pool = { async connect() { return client; } };

  const saved = await createDeedInvestigationCaseAction(pool, "case-1", {
    subjectName: "Jim English",
    actionType: "inter_ashes",
    plotReference: "61 OC James and Margaret Sarver graves",
    councilStatus: "recommended",
    councilDecisionDate: "2026-03-17",
    councilDocumentReference: "Council minutes 2026-03-17",
    affidavitStatus: "needed",
    deedStatus: "pending",
    notes: "Ashes over grandparents.",
    sortOrder: 200,
  });

  assert.equal(saved.subjectName, "Jim English");
  assert.equal(saved.actionType, "inter_ashes");
  assert.equal(calls.at(-1).sql, "release");
});

test("updateDeedInvestigationCaseAction updates a recommended action by case", async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("set_config")) return { rows: [] };
      if (sql.includes("UPDATE deed_investigation_case_actions")) {
        assert.equal(values[0], "case-1");
        assert.equal(values[1], "action-1");
        assert.equal(values[5], "approved");
        assert.equal(values[6], "2026-03-18");
        assert.equal(values[7], "Council minutes 2026-03-18");
        return {
          rows: [
            {
              id: "action-1",
              case_id: "case-1",
              subject_name: "Elaine Krepps Wasko",
              action_type: "replacement_deed",
              plot_reference: "61 OC grave 4",
              council_status: "approved",
              council_decision_date: "2026-03-18",
              council_document_reference: "Council minutes 2026-03-18",
              affidavit_status: "received",
              deed_status: "issued",
              outcome: "Replacement deed issued.",
              notes: "",
              sort_order: 100,
              created_at: "2026-03-17T12:00:00.000Z",
              updated_at: "2026-03-18T12:00:00.000Z",
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {
      calls.push({ sql: "release" });
    },
  };
  const pool = { async connect() { return client; } };

  const saved = await updateDeedInvestigationCaseAction(pool, "case-1", "action-1", {
    subjectName: "Elaine Krepps Wasko",
    actionType: "replacement_deed",
    plotReference: "61 OC grave 4",
    councilStatus: "approved",
    councilDecisionDate: "2026-03-18",
    councilDocumentReference: "Council minutes 2026-03-18",
    affidavitStatus: "received",
    deedStatus: "issued",
    outcome: "Replacement deed issued.",
    sortOrder: 100,
  });

  assert.equal(saved?.councilStatus, "approved");
  assert.equal(saved?.councilDecisionDate, "2026-03-18");
  assert.equal(saved?.councilDocumentReference, "Council minutes 2026-03-18");
  assert.equal(saved?.deedStatus, "issued");
  assert.equal(calls.at(-1).sql, "release");
});
