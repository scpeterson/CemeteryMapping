import assert from "node:assert/strict";
import test from "node:test";
import { getCemeteryData, getDetailedCemeteryData } from "./cemeteryMapResponses.mjs";

const flush = () => new Promise((resolve) => setImmediate(resolve));

for (const detailed of [false, true]) {
  test(`${detailed ? "detailed" : "summary"} map query loading is bounded and skips unused work`, async () => {
    let active = 0, maximum = 0;
    const queries = [];
    const pool = { async query(sql) {
      queries.push(sql);
      if (sql.includes("FROM cemeteries")) return { rows: [{ id: "cemetery", name: "Test", geometry: "{}" }] };
      maximum = Math.max(maximum, ++active);
      await flush(); active--;
      if (sql.includes("FROM sections")) return { rows: [{ section_id: "A", cemetery_id: "cemetery", name: "Section A", geometry: "{}" }] };
      if (sql.includes("FROM lots")) return { rows: [{ lot_id: "1", name: "Lot 1", cemetery_id: "cemetery", geometry: "{}" }] };
      return { rows: [] };
    } };
    const data = detailed ? await getDetailedCemeteryData(pool, { includeOwnership: false }) : await getCemeteryData(pool);
    assert.equal(maximum, 3); assert.equal(active, 0);
    assert.equal(data.sections[0].name, "Section A");
    assert.equal(data.sections[0].cemeteryId, "cemetery"); assert.equal(data.lots[0].name, "Lot 1");
    assert.equal(queries.filter((sql) => sql.includes("ST_AsGeoJSON(headstones.geometry)")).length, detailed ? 0 : 1);
    assert.ok(!queries.some((sql) => sql.includes("FROM owners\n")), "do not issue an unused ownership detail query");
  });
}

test("map loading drains already-started queries before reporting a failure", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let rejected = false, started = 0;
  const pool = { async query(sql) {
    if (sql.includes("FROM cemeteries")) return { rows: [{ id: "cemetery", name: "Test" }] };
    started++;
    if (sql.includes("FROM sections")) throw new Error("Query failed");
    await pending;
    return { rows: [] };
  } };
  const result = assert.rejects(getCemeteryData(pool), /Query failed/u).then(() => { rejected = true; });
  await flush(); assert.equal(rejected, false); assert.equal(started, 3);
  release(); await result; assert.equal(started, 3);
});
