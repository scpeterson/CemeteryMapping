import assert from "node:assert/strict";
import { test } from "node:test";
import { listDataQualityDashboard } from "./dataQualityRepository.mjs";

test("listDataQualityDashboard scopes admins to all cemeteries and totals actionable counts", async () => {
  const queries = [];
  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      return {
        rows: [
          {
            id: "lots_without_gravesites",
            label: "Lots without gravesites",
            description: "Informational",
            count: "4",
            severity: "info",
            category: "Map links",
          },
          {
            id: "nhg_review_needed",
            label: "NHG readings needing review",
            description: "Needs review",
            count: "3",
            severity: "high",
            category: "Readings",
          },
          {
            id: "photos_missing_date_taken",
            label: "Photos missing date taken",
            description: "Needs captured date",
            count: "2",
            severity: "low",
            category: "Media",
          },
        ],
      };
    },
  };

  const dashboard = await listDataQualityDashboard(pool);

  assert.equal(queries.length, 2);
  assert.equal(queries[0].values[0], null);
  assert.match(queries[1].sql, /scoped_cemeteries/u);
  assert.match(queries[1].sql, /headstone_gravesites/u);
  assert.match(queries[1].sql, /burials_review_needed/u);
  assert.match(queries[1].sql, /markers_review_needed/u);
  assert.equal(dashboard.scope, "all");
  assert.equal(dashboard.totalOpenItems, 5);
  assert.deepEqual(
    dashboard.metrics.map((metric) => metric.id),
    ["nhg_review_needed", "photos_missing_date_taken", "lots_without_gravesites"],
  );
});

test("listDataQualityDashboard deduplicates assigned cemetery scope", async () => {
  const queries = [];
  const pool = {
    async query(_sql, values) {
      queries.push(values);
      return { rows: [] };
    },
  };

  const cemeteryId = "11111111-1111-4111-8111-111111111111";
  const dashboard = await listDataQualityDashboard(pool, { cemeteryIds: [cemeteryId, cemeteryId, ""] });

  assert.deepEqual(queries[0][0], [cemeteryId]);
  assert.equal(dashboard.scope, "assigned");
  assert.equal(dashboard.totalOpenItems, 0);
});

for (const allowed of [undefined, ['11111111-1111-4111-8111-111111111111'], []]) {
  test(`selected cemetery cannot broaden assigned access (${JSON.stringify(allowed)})`, async () => {
    const values = [];
    const pool = { query: async (_sql, params) => { values.push(params[0]); return { rows: [] }; } };
    const id = '22222222-2222-4222-8222-222222222222';
    await listDataQualityDashboard(pool, { cemeteryIds: allowed, cemeteryId: id });
    assert.deepEqual(values[0], allowed ?? null);
    assert.deepEqual(values[1], allowed === undefined ? [id] : []);
  });
}
