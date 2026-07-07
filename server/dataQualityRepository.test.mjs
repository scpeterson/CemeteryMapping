import assert from "node:assert/strict";
import { test } from "node:test";
import { listDataQualityDashboard } from "./dataQualityRepository.mjs";

test("listDataQualityDashboard scopes admins to all cemeteries and totals actionable counts", async () => {
  const queries = [];
  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("information_schema.columns")) {
        return { rows: [{ burial_columns_exist: true, headstone_columns_exist: true }] };
      }
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
  assert.equal(queries[1].values[0], null);
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
      if (_sql.includes("information_schema.columns")) {
        return { rows: [{ burial_columns_exist: true, headstone_columns_exist: true }] };
      }
      return { rows: [] };
    },
  };

  const cemeteryId = "11111111-1111-4111-8111-111111111111";
  const dashboard = await listDataQualityDashboard(pool, { cemeteryIds: [cemeteryId, cemeteryId, ""] });

  assert.deepEqual(queries[1][0], [cemeteryId]);
  assert.equal(dashboard.scope, "assigned");
  assert.equal(dashboard.totalOpenItems, 0);
});
