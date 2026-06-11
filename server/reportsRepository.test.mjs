import assert from "node:assert/strict";
import test from "node:test";
import { listReportsForUser, matchReportQuery, runReport } from "./reportsRepository.mjs";

const adminUser = { role: "admin", cemeteryAccess: [] };
const powerUser = {
  role: "power-user",
  cemeteryAccess: [{ cemeteryId: "11111111-1111-4111-8111-111111111111", canEdit: true }],
};
const readerUser = {
  role: "reader",
  cemeteryAccess: [{ cemeteryId: "22222222-2222-4222-8222-222222222222", canEdit: false }],
};

function poolForRows(rowsByQuery) {
  const queries = [];
  return {
    queries,
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          const entry = rowsByQuery.find((candidate) => sql.includes(candidate.includes));
          if (!entry) throw new Error(`Unexpected query: ${sql}`);
          return { rows: entry.rows };
        },
        release() {},
      };
    },
  };
}

test("listReportsForUser filters reports by role", () => {
  assert.deepEqual(
    listReportsForUser(readerUser).map((report) => report.id),
    ["burial-date-extremes", "veteran-service-summary"],
  );
  assert.deepEqual(
    listReportsForUser(powerUser).map((report) => report.id),
    ["burial-date-extremes", "veteran-service-summary", "owner-holdings", "available-inventory"],
  );
  assert.ok(listReportsForUser(adminUser).some((report) => report.id === "deed-claim-trace-guide"));
});

test("matchReportQuery maps free text only to approved reports", () => {
  assert.equal(matchReportQuery("What is the oldest burial?").report.id, "burial-date-extremes");
  assert.equal(matchReportQuery("How many veterans and what wars?").report.id, "veteran-service-summary");
  assert.equal(matchReportQuery("What gravesites are available for purchase?").report.id, "available-inventory");
  assert.equal(matchReportQuery("How do we trace a deed claim without paperwork for a lot?").report.id, "deed-claim-trace-guide");

  const ownerMatch = matchReportQuery("How many lots are owned by Sarah Stone?");
  assert.equal(ownerMatch.report.id, "owner-holdings");
  assert.equal(ownerMatch.parameters.ownerName, "Sarah Stone");

  const unknown = matchReportQuery("Show me every raw table in the database");
  assert.equal(unknown.matched, false);
});

test("runReport rejects reports above the user role", async () => {
  await assert.rejects(() => runReport({ connect() {} }, "owner-holdings", { ownerName: "Smith" }, readerUser), /Forbidden/u);
});

test("owner holdings report scopes power users to assigned cemeteries", async () => {
  const pool = poolForRows([
    {
      includes: "WITH matched_holdings",
      rows: [
        {
          cemetery: "Trinity",
          owner_name: "Sarah Stone",
          target_type: "lot",
          record_label: "C-10",
          effective_date: "2025-01-01",
          event_type: "deed",
          document_reference: "Book 1",
          source: "Ownership events",
        },
        {
          cemetery: "Trinity",
          owner_name: "Sarah Stone",
          target_type: "gravesite",
          record_label: "C-0180",
          effective_date: "2025-01-01",
          event_type: "deed",
          document_reference: "Book 1",
          source: "Ownership events",
        },
      ],
    },
  ]);

  const result = await runReport(pool, "owner-holdings", { ownerName: "Stone" }, powerUser);
  const query = pool.queries[0];

  assert.match(query.sql, /cemeteries\.id = ANY\(\$2::uuid\[\]\)/u);
  assert.deepEqual(query.values, ["%Stone%", ["11111111-1111-4111-8111-111111111111"]]);
  assert.equal(result.summary, '1 lot and 1 gravesite matched "Stone".');
});

test("reader reports are scoped to assigned cemeteries", async () => {
  const pool = poolForRows([
    {
      includes: "WITH eligible_burials",
      rows: [],
    },
  ]);

  await runReport(pool, "burial-date-extremes", {}, readerUser);
  const query = pool.queries[0];

  assert.match(query.sql, /gravesites\.cemetery_id = ANY\(\$1::uuid\[\]\)/u);
  assert.deepEqual(query.values, [["22222222-2222-4222-8222-222222222222"]]);
});

test("non-admin reports ignore client supplied cemetery filters", async () => {
  const pool = poolForRows([
    {
      includes: "WITH veteran_burials",
      rows: [{ group_name: "Summary", label: "Veteran burials", count: 0 }],
    },
  ]);

  await runReport(pool, "veteran-service-summary", { cemeteryId: "99999999-9999-4999-8999-999999999999" }, readerUser);
  const query = pool.queries[0];

  assert.match(query.sql, /gravesites\.cemetery_id = ANY\(\$1::uuid\[\]\)/u);
  assert.deepEqual(query.values, [["22222222-2222-4222-8222-222222222222"]]);
});

test("admin reports can select one cemetery or all cemeteries", async () => {
  const selectedPool = poolForRows([
    {
      includes: "WITH veteran_burials",
      rows: [{ group_name: "Summary", label: "Veteran burials", count: 0 }],
    },
  ]);
  await runReport(selectedPool, "veteran-service-summary", { cemeteryId: "33333333-3333-4333-8333-333333333333" }, adminUser);
  assert.match(selectedPool.queries[0].sql, /gravesites\.cemetery_id = ANY\(\$1::uuid\[\]\)/u);
  assert.deepEqual(selectedPool.queries[0].values, [["33333333-3333-4333-8333-333333333333"]]);

  const allPool = poolForRows([
    {
      includes: "WITH veteran_burials",
      rows: [{ group_name: "Summary", label: "Veteran burials", count: 0 }],
    },
  ]);
  await runReport(allPool, "veteran-service-summary", { cemeteryId: "__all" }, adminUser);
  assert.doesNotMatch(allPool.queries[0].sql, /cemetery_id = ANY/u);
  assert.deepEqual(allPool.queries[0].values, []);
});

test("available inventory report uses derived gravesite status", async () => {
  const pool = poolForRows([
    {
      includes: "WITH available_gravesites",
      rows: [{ target_type: "gravesite", cemetery: "Trinity", record_label: "C-0180", gravesite_count: 1, total_cost: 500, gravesite_id: "TLC-GPS-0180" }],
    },
  ]);

  const result = await runReport(pool, "available-inventory", {}, powerUser);
  const query = pool.queries[0];

  assert.match(query.sql, /FROM burials status_burials/u);
  assert.match(query.sql, /FROM current_ownership_right_owners status_rights/u);
  assert.equal(result.rows.length, 1);
});
