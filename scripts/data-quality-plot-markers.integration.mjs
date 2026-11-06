import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";
import { listDataQualityDashboard } from "../server/dataQualityRepository.mjs";
import { integrationAdminDatabase } from "./lib/integration-admin.mjs";

test("unlinked marker quality count excludes plot marker types and scopes", async () => {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  const client = new pg.Client(integrationAdminDatabase(config));
  await client.connect();
  try {
    await client.query("BEGIN");
    const template = (await client.query(`
      SELECT h.*, g.cemetery_id FROM headstones h
      JOIN gravesites g ON g.id = h.gravesite_uuid
      JOIN marker_types t ON t.id = h.marker_type_id AND t.code <> 'plot_marker'
      JOIN marker_scope_types s ON s.id = h.marker_scope_type_id AND s.code <> 'plot_marker'
      WHERE h.deleted_at IS NULL AND g.deleted_at IS NULL LIMIT 1
    `)).rows[0];
    assert.ok(template, "Seed demo data before running quality integration tests");
    const count = async () => {
      const dashboard = await listDataQualityDashboard(client, { cemeteryId: template.cemetery_id });
      return dashboard.metrics.find((metric) => metric.id === "markers_without_gravesites").count;
    };
    const baseline = await count();
    const id = randomUUID();
    await client.query(`
      INSERT INTO headstones (id, headstone_id, marker_type_id, marker_scope_type_id,
        material_type_id, condition_type_id, geometry)
      SELECT $1, $2, $3, $4, $5, $6, ST_PointOnSurface(geometry)
      FROM cemeteries WHERE id = $7
    `, [id, `QUALITY-${id}`, template.marker_type_id, template.marker_scope_type_id,
      template.material_type_id, template.condition_type_id, template.cemetery_id]);
    assert.equal(await count(), baseline + 1, "ordinary unlinked markers remain actionable");
    await client.query(`UPDATE headstones SET marker_type_id =
      (SELECT id FROM marker_types WHERE code = 'plot_marker') WHERE id = $1`, [id]);
    assert.equal(await count(), baseline, "plot marker type is excluded");
    await client.query(`UPDATE headstones SET marker_type_id = $2, marker_scope_type_id =
      (SELECT id FROM marker_scope_types WHERE code = 'plot_marker') WHERE id = $1`, [id, template.marker_type_id]);
    assert.equal(await count(), baseline, "plot marker scope is excluded independently");
    await client.query("UPDATE headstones SET marker_scope_type_id = $2 WHERE id = $1", [id, template.marker_scope_type_id]);
    assert.equal(await count(), baseline + 1);
    await client.query("INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid) VALUES ($1, $2)", [id, template.gravesite_uuid]);
    assert.equal(await count(), baseline, "ordinary linked markers remain excluded");
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
