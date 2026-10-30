import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import pg from "pg";
import { getCemeteryData, getGraveSpace, getHeadstone } from "../server/cemeteryRepository.mjs";
import { searchCemetery } from "../server/cemeterySearch.mjs";
import { runReport } from "../server/reportsRepository.mjs";
import { artifactDirectory, localConfig, readOnlyClient, spatialFingerprint, writePrivate } from "./lib/local-db-review.mjs";

const { values } = parseArgs({ options: { env: { type: "string" }, runs: { type: "string", default: "9" },
  "jit-off": { type: "boolean", default: false },
  "refresh-statistics": { type: "boolean", default: false } } });
const environment = values.env ?? process.env.APP_ENV ?? "dev";
const runs = Number(values.runs);
if (!Number.isInteger(runs) || runs < 3 || runs > 30) throw new Error("--runs must be between 3 and 30.");
const inspector = await readOnlyClient(environment);
const pool = new pg.Pool({ ...localConfig(environment, { runtime: true }), max: 4,
  options: `-c default_transaction_read_only=on${values["jit-off"] ? " -c jit=off" : ""}` });
const output = artifactDirectory("query-benchmarks", environment);
const report = { environment, runs, jitOff: values["jit-off"], warmups: 2, timing: "Warm-cache repository calls, including database round trips and result mapping; excludes HTTP/browser.",
  startedAt: new Date().toISOString(), spatialBefore: await spatialFingerprint(inspector) };
const statistics = async () => (await inspector.query(`SELECT count(*)::int AS tables,
  count(*) FILTER (WHERE n_live_tup>0 AND last_analyze IS NULL AND last_autoanalyze IS NULL)::int AS "populatedNeverAnalyzed"
  FROM pg_stat_user_tables`)).rows[0];
try {
  const map = await getCemeteryData(pool);
  const grave = map.graves[0], headstone = map.headstones[0];
  assert.ok(grave && headstone, "Benchmark needs at least one active grave and mapped headstone.");
  const workloads = {
    map: p => getCemeteryData(p),
    graveDetail: p => getGraveSpace(p, grave.cemeteryId, grave.id),
    headstoneDetail: p => getHeadstone(p, headstone.id),
    searchGrave: p => searchCemetery(p, { query: grave.id }),
    searchBroad: p => searchCemetery(p, { query: "a", limit: 50 }),
    searchNoMatch: p => searchCemetery(p, { query: "benchmarknomatch938172" }),
    spatialInventory: p => runReport(p, "spatial-inventory-counts", {}, { role: "admin" }),
    availableInventory: p => runReport(p, "available-inventory", {}, { role: "admin" }),
    spatialValidation: p => p.query("SELECT severity,issue_code,count(*) FROM spatial_validation_issues GROUP BY severity,issue_code ORDER BY 1,2"),
  };
  async function benchmark() {
    const results = {};
    for (const [name, run] of Object.entries(workloads)) {
      const queries = new Map();
      const query = async (text, params) => {
        queries.set(JSON.stringify([text, params]), { text, params });
        return pool.query(text, params);
      };
      // Reports use a checked-out client. Preserve their execution behavior.
      const target = { query, connect: async () => {
        const client = await pool.connect();
        return { query: (text, params) => { queries.set(JSON.stringify([text, params]), { text, params }); return client.query(text, params); }, release: () => client.release() };
      } };
      for (let i = 0; i < 2; i++) await run(target);
      const samples = [];
      for (let i = 0; i < runs; i++) {
        const start = performance.now(); await run(target); samples.push(performance.now() - start);
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const plans = [];
      for (const { text, params } of queries.values()) {
        const plan = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`, params);
        plans.push({ sql: text, parameters: params, plan: plan.rows[0]["QUERY PLAN"] });
      }
      results[name] = { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], samplesMs: samples, plans };
    }
    return results;
  }
  report.statisticsBefore = await statistics();
  report.before = await benchmark();
  writePrivate(output, "before.json", report);
  if (values["refresh-statistics"]) {
    const admin = new pg.Client(localConfig(environment));
    try { await admin.connect(); await admin.query("ANALYZE"); }
    finally { await admin.end(); }
    await inspector.query("SELECT pg_stat_clear_snapshot()");
    report.statisticsRefreshed = true;
    report.after = await benchmark();
    report.statisticsAfter = await statistics();
  }
  report.spatialAfter = await spatialFingerprint(inspector);
  assert.deepEqual(report.spatialAfter, report.spatialBefore, "Spatial records changed during benchmark; investigate concurrent application edits.");
  report.completedAt = new Date().toISOString();
  writePrivate(output, "benchmark.json", report);
  console.log(JSON.stringify({ environment, output, statisticsBefore: report.statisticsBefore, statisticsAfter: report.statisticsAfter,
    spatialRecordsUnchanged: true, queries: Object.fromEntries(Object.entries(report.after ?? report.before).map(([name, r]) => [name,
      { beforeMedianMs: +report.before[name].medianMs.toFixed(2), afterMedianMs: report.after ? +r.medianMs.toFixed(2) : null }])) }, null, 2));
} finally { await pool.end(); await inspector.end(); }
