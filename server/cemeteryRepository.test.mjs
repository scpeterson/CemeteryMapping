import assert from "node:assert/strict";
import test from "node:test";
import { getCemeteryData, getDetailedCemeteryData, getGraveSpace } from "./cemeteryRepository.mjs";

function queryRows(sql) {
  if (sql.includes("information_schema.columns")) return [{ exists: true }];
  if (sql.includes("FROM cemeteries")) {
    return [{ id: "11111111-1111-4111-8111-111111111111", name: "Sequential Cemetery", geometry: "{}" }];
  }
  if (sql.includes("FROM sections")) return [];
  if (sql.includes("FROM lots")) return [];
  if (sql.includes("FROM gravesites") && sql.includes("LIMIT 1")) {
    return [
      {
        uuid: "22222222-2222-4222-8222-222222222222",
        cemetery_id: "11111111-1111-4111-8111-111111111111",
        cemetery_name: "Sequential Cemetery",
        section_id: "A",
        lot_id: "1",
        grave_id: "1",
        gravesite_id: "A-01-01",
        status: "occupied",
        geometry: "{}",
      },
    ];
  }
  if (sql.includes("FROM gravesites")) return [];
  if (sql.includes("FROM owners")) return [];
  if (sql.includes("FROM burials")) return [];
  throw new Error(`Unexpected query: ${sql}`);
}

function strictSequentialPool() {
  return {
    async connect() {
      let activeQueries = 0;
      return {
        async query(sql) {
          activeQueries += 1;
          assert.equal(activeQueries, 1, "queries on a checked-out pg client must not overlap");
          await Promise.resolve();
          activeQueries -= 1;
          return { rows: queryRows(sql) };
        },
        release() {},
      };
    },
  };
}

test("repository read queries do not overlap on the same pg client", async () => {
  const pool = strictSequentialPool();

  await getCemeteryData(pool);
  await getDetailedCemeteryData(pool);
  await getGraveSpace(pool, "11111111-1111-4111-8111-111111111111", "A-01-01");
});

test("repository can redact ownership data from grave detail reads", async () => {
  let ownerQueryCount = 0;
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql.includes("FROM owners")) ownerQueryCount += 1;
          return { rows: queryRows(sql) };
        },
        release() {},
      };
    },
  };

  const grave = await getGraveSpace(pool, "11111111-1111-4111-8111-111111111111", "A-01-01", { includeOwnership: false });

  assert.equal(ownerQueryCount, 0);
  assert.deepEqual(grave.owners, []);
  assert.deepEqual(grave.currentOwnerIds, []);
  assert.deepEqual(grave.ownershipHistory, []);
});
